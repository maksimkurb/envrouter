package envrouter

import (
	"errors"
	"fmt"
	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/object"
	"github.com/go-git/go-git/v5/plumbing/transport/http"
	"github.com/go-git/go-git/v5/plumbing/transport/ssh"
	log "github.com/sirupsen/logrus"
	"gitlab.com/jonasasx/envrouter/internal/envrouter/api"
	"gitlab.com/jonasasx/envrouter/internal/utils"
	"os"
	"path/filepath"
	"reflect"
	"sync"

	cryptossh "golang.org/x/crypto/ssh"
	"strings"
	"time"
)

// RefKind distinguishes a branch from a tag in the supplied refs.
const (
	RefKindBranch = "branch"
	RefKindTag    = "tag"
)

type GitClient interface {
	GetCommitByHash(repositoryName string, hash string) (*api.Commit, error)
	SupplyRefsHeads(repositoryName string, supplier func(ref string, commit *api.Commit, kind string)) error
}

type gitClient struct {
	repositoryService        RepositoryService
	credentialsSecretService CredentialsSecretService
	mu                       sync.Mutex
	repoLocks                map[string]*sync.Mutex
	lastFetch                map[string]time.Time
}

func NewGitClient(
	repositoryService RepositoryService,
	credentialsSecretService CredentialsSecretService,
) GitClient {
	return &gitClient{
		repositoryService:        repositoryService,
		credentialsSecretService: credentialsSecretService,
		repoLocks:                map[string]*sync.Mutex{},
		lastFetch:                map[string]time.Time{},
	}
}

// ponytail: fixed 15s throttle between on-demand fetches for the same repo.
// The scan job fetches every 30s anyway, so commit lookups only fetch when a
// requested commit is genuinely absent locally and the cache is cold.
const commitFetchThrottle = 15 * time.Second

// repoPath maps a repository name to its on-disk clone path, rejecting names
// that could escape /tmp/git via path separators or traversal.
func repoPath(repositoryName string) (string, error) {
	if repositoryName == "" || strings.ContainsAny(repositoryName, `/\`) || strings.Contains(repositoryName, "..") {
		return "", fmt.Errorf("invalid repository name %q", repositoryName)
	}
	return filepath.Join("/tmp/git", repositoryName), nil
}

// lockRepository serializes all on-disk access to a single repository:
// go-git's filesystem storage is not safe under concurrent clone/fetch/read.
func (g *gitClient) lockRepository(repositoryName string) *sync.Mutex {
	g.mu.Lock()
	defer g.mu.Unlock()
	l, ok := g.repoLocks[repositoryName]
	if !ok {
		l = &sync.Mutex{}
		g.repoLocks[repositoryName] = l
	}
	return l
}

func (g *gitClient) getRepository(repositoryName string) (r *git.Repository, err error) {
	defer func() {
		if rec := recover(); rec != nil {
			err = fmt.Errorf("panic during git operation for %s: %v", repositoryName, rec)
			log.Errorf("Recovered from panic in getRepository(%s): %v", repositoryName, rec)
		}
	}()

	options, err := g.getGitOptions(repositoryName)
	if err != nil {
		return nil, err
	}
	path, err := repoPath(repositoryName)
	if err != nil {
		return nil, err
	}
	if _, err := os.Stat(path); os.IsNotExist(err) {
		r, err = git.PlainClone(path, true, options)
		if err != nil {
			return nil, err
		}
	} else {
		log.Debugf("Start fetching %s", repositoryName)
		r, err = git.PlainOpenWithOptions(path, &git.PlainOpenOptions{})
		if err != nil {
			return nil, err
		}
		err = r.Fetch(&git.FetchOptions{RemoteName: "origin", Auth: options.Auth, Progress: options.Progress})
		if err != nil && !errors.Is(err, git.NoErrAlreadyUpToDate) {
			return nil, err
		}
		log.Debugf("Fetched %s", repositoryName)
	}
	return r, nil
}

// getRepositoryNoFetch opens the local repo (cloning only if absent) without
// fetching. Used by on-demand commit lookups so a cache miss doesn't force a
// network round-trip on every request.
func (g *gitClient) getRepositoryNoFetch(repositoryName string) (r *git.Repository, err error) {
	defer func() {
		if rec := recover(); rec != nil {
			err = fmt.Errorf("panic during git operation for %s: %v", repositoryName, rec)
			log.Errorf("Recovered from panic in getRepositoryNoFetch(%s): %v", repositoryName, rec)
		}
	}()

	options, err := g.getGitOptions(repositoryName)
	if err != nil {
		return nil, err
	}
	path, err := repoPath(repositoryName)
	if err != nil {
		return nil, err
	}
	if _, err := os.Stat(path); os.IsNotExist(err) {
		r, err = git.PlainClone(path, true, options)
		if err != nil {
			return nil, err
		}
		g.mu.Lock()
		g.lastFetch[repositoryName] = time.Now()
		g.mu.Unlock()
		return r, nil
	}
	return git.PlainOpenWithOptions(path, &git.PlainOpenOptions{})
}

func (g *gitClient) fetchIfStale(repositoryName string, r *git.Repository) error {
	g.mu.Lock()
	last := g.lastFetch[repositoryName]
	g.mu.Unlock()
	if time.Since(last) < commitFetchThrottle {
		return nil
	}
	options, err := g.getGitOptions(repositoryName)
	if err != nil {
		return err
	}
	err = r.Fetch(&git.FetchOptions{RemoteName: "origin", Auth: options.Auth, Progress: options.Progress})
	g.mu.Lock()
	g.lastFetch[repositoryName] = time.Now()
	g.mu.Unlock()
	if err != nil && !errors.Is(err, git.NoErrAlreadyUpToDate) {
		return err
	}
	return nil
}

func (g *gitClient) GetCommitByHash(repositoryName string, hash string) (*api.Commit, error) {
	lock := g.lockRepository(repositoryName)
	lock.Lock()
	defer lock.Unlock()
	r, err := g.getRepositoryNoFetch(repositoryName)
	if err != nil {
		return nil, err
	}
	h := plumbing.NewHash(hash)
	if commit, err := g.getCommitByHash(r, h); err == nil {
		return commit, nil
	}
	// commit not present locally — fetch (throttled) and retry once
	if err := g.fetchIfStale(repositoryName, r); err != nil {
		return nil, err
	}
	return g.getCommitByHash(r, h)
}

func (g *gitClient) getCommitByHash(repository *git.Repository, hash plumbing.Hash) (*api.Commit, error) {
	commit, err := repository.CommitObject(hash)
	if err != nil {
		return nil, err
	}
	return commitToAPI(commit), nil
}

func commitToAPI(commit *object.Commit) *api.Commit {
	when := commit.Author.When.Format(time.RFC3339)
	return &api.Commit{
		Author:    &commit.Author.Name,
		Message:   &commit.Message,
		Sha:       commit.Hash.String(),
		Timestamp: &when,
	}
}

// resolveTagCommit dereferences a tag ref to its commit: an annotated tag's
// hash points at a tag object (deref via TagObject → Commit); a lightweight
// tag's hash points straight at the commit.
func (g *gitClient) resolveTagCommit(repository *git.Repository, hash plumbing.Hash) (*api.Commit, error) {
	if tag, err := repository.TagObject(hash); err == nil {
		commit, err := tag.Commit()
		if err != nil {
			return nil, err
		}
		return commitToAPI(commit), nil
	}
	return g.getCommitByHash(repository, hash)
}

func (g *gitClient) SupplyRefsHeads(repositoryName string, supplier func(ref string, commit *api.Commit, kind string)) error {
	lock := g.lockRepository(repositoryName)
	lock.Lock()
	defer lock.Unlock()
	r, err := g.getRepository(repositoryName)
	if err != nil {
		return err
	}
	iter, err := r.References()
	if err != nil {
		return err
	}
	err = iter.ForEach(func(ref *plumbing.Reference) error {
		name := string(ref.Name())
		switch {
		case strings.HasPrefix(name, "refs/remotes/origin/"):
			refName := strings.Replace(ref.Name().Short(), "origin/", "", 1)
			log.Debugf("branch: %v", refName)
			commit, err := g.getCommitByHash(r, ref.Hash())
			if err != nil {
				return err
			}
			supplier(refName, commit, RefKindBranch)
		case strings.HasPrefix(name, "refs/tags/"):
			refName := ref.Name().Short() // strips refs/tags/
			log.Debugf("tag: %v", refName)
			commit, err := g.resolveTagCommit(r, ref.Hash())
			if err != nil {
				// a single unresolvable tag must not abort the whole scan
				log.Warnf("skipping tag %s in %s: %v", refName, repositoryName, err)
				return nil
			}
			supplier(refName, commit, RefKindTag)
		}
		return nil
	})
	if err != nil {
		return err
	}
	return nil
}

func (g *gitClient) getGitOptions(repositoryName string) (*git.CloneOptions, error) {
	repository, err := g.repositoryService.FindByName(repositoryName)
	if err != nil {
		return nil, err
	}
	credentials, err := g.credentialsSecretService.FindByName(repository.CredentialsSecret)
	if err != nil {
		return nil, err
	}

	options := &git.CloneOptions{
		NoCheckout: true,
		URL:        repository.Url,
		Progress:   nil,
	}

	if credentials != nil {
		if len(credentials.Username) > 0 && len(credentials.Password) > 0 {
			options.Auth = &http.BasicAuth{
				Username: credentials.Username,
				Password: credentials.Password,
			}
		} else if len(credentials.Key) > 0 {
			key, err := ssh.NewPublicKeys("git", []byte(credentials.Key), "")
			if err != nil {
				return nil, err
			}
			key.HostKeyCallbackHelper = ssh.HostKeyCallbackHelper{
				HostKeyCallback: cryptossh.InsecureIgnoreHostKey(),
			}
			options.Auth = key
		}
	}
	return options, nil
}

type GitStorage interface {
	GetAllRefsHeads() ([]*api.Ref, error)
	GetCommitByHash(applicationName string, hash string) (*api.Commit, error)
	ScanRefsHeads(repositoryName string) error
}

type gitStorage struct {
	gitClient      GitClient
	eventsObserver utils.Observer
	mu             sync.RWMutex
	commits        map[string]*api.Commit
	// repo -> ref name -> ref head (carries branch/tag type)
	refs map[string]map[string]*api.Ref
}

func NewGitStorage(
	gitClient GitClient,
	eventsObserver utils.Observer,
) GitStorage {
	return &gitStorage{
		gitClient:      gitClient,
		eventsObserver: eventsObserver,
		commits:        map[string]*api.Commit{},
		refs:           map[string]map[string]*api.Ref{},
	}
}

func (g *gitStorage) GetAllRefsHeads() ([]*api.Ref, error) {
	g.mu.RLock()
	defer g.mu.RUnlock()
	result := []*api.Ref{}
	for _, v := range g.refs {
		for _, ref := range v {
			refCopy := *ref
			result = append(result, &refCopy)
		}
	}
	return result, nil
}

func (g *gitStorage) GetCommitByHash(repositoryName string, hash string) (*api.Commit, error) {
	g.mu.RLock()
	commit, ok := g.commits[hash]
	g.mu.RUnlock()
	if ok {
		return commit, nil
	}
	commit, err := g.gitClient.GetCommitByHash(repositoryName, hash)
	if err != nil {
		return nil, err
	}
	if commit != nil {
		g.mu.Lock()
		// ponytail: crude cap instead of LRU; the map only grows on cache
		// misses for commits outside branch heads, so a reset is cheap
		if len(g.commits) > 10000 {
			g.commits = map[string]*api.Commit{}
		}
		g.commits[hash] = commit
		g.mu.Unlock()
	}
	return commit, nil
}

func (g *gitStorage) addRefHeadCommit(repositoryName string, ref string, commit *api.Commit, kind string) {
	newRef := &api.Ref{
		Repository: repositoryName,
		Commit:     *commit,
		Ref:        ref,
		Type:       kind,
	}
	g.mu.Lock()
	g.commits[commit.Sha] = commit
	if _, ok := g.refs[repositoryName]; !ok {
		g.refs[repositoryName] = map[string]*api.Ref{}
	}
	old, ok := g.refs[repositoryName][ref]
	changed := !ok || !reflect.DeepEqual(old, newRef)
	if changed {
		g.refs[repositoryName][ref] = newRef
	}
	g.mu.Unlock()
	if changed {
		g.eventsObserver.Publish(nil, api.SSEvent{
			ItemType: "RefHead",
			Item:     *newRef,
			Event:    "UPDATED",
		})
	}
}

func (g *gitStorage) ScanRefsHeads(repositoryName string) error {
	seen := map[string]bool{}
	err := g.gitClient.SupplyRefsHeads(repositoryName, func(ref string, commit *api.Commit, kind string) {
		seen[ref] = true
		g.addRefHeadCommit(repositoryName, ref, commit, kind)
	})
	if err != nil {
		return err
	}
	// evict refs deleted upstream so the UI stops offering stale branches/tags
	g.mu.Lock()
	var deleted []api.Ref
	for ref, refHead := range g.refs[repositoryName] {
		if !seen[ref] {
			deleted = append(deleted, *refHead)
			delete(g.refs[repositoryName], ref)
		}
	}
	g.mu.Unlock()
	for _, d := range deleted {
		g.eventsObserver.Publish(nil, api.SSEvent{
			ItemType: "RefHead",
			Item:     d,
			Event:    "DELETED",
		})
	}
	return nil
}

type GitScanJob interface {
	Scan()
}

type gitScanJob struct {
	repositoryService RepositoryService
	gitStorage        GitStorage
}

func NewGitScanJob(repositoryService RepositoryService, gitStorage GitStorage) GitScanJob {
	return &gitScanJob{
		repositoryService: repositoryService,
		gitStorage:        gitStorage,
	}
}

func (g *gitScanJob) Scan() {
	for {
		rs, err := g.repositoryService.FindAll()
		if err != nil {
			log.Errorf("Error on git scan %v", err)
		}
		for _, v := range rs {
			err := g.gitStorage.ScanRefsHeads(v.Name)
			if err != nil {
				log.Errorf("Error on git scan %v", err)
			}
		}
		log.Info("ScanRefsHeads finished")
		time.Sleep(30 * time.Second)
	}
}
