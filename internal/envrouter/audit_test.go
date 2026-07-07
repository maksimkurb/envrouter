package envrouter

import (
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestAuditLog_NewestFirstAndScoped(t *testing.T) {
	log := NewAuditLog()
	log.Record(RefSwitch{Time: time.Now(), Environment: "qa", Application: "app", NewRef: "first"})
	log.Record(RefSwitch{Time: time.Now(), Environment: "qa", Application: "app", NewRef: "second"})
	log.Record(RefSwitch{Time: time.Now(), Environment: "prod", Application: "app", NewRef: "other"})

	records := log.Find("qa", "app")
	assert.Len(t, records, 2)
	assert.Equal(t, "second", records[0].NewRef)
	assert.Equal(t, "first", records[1].NewRef)
	assert.Empty(t, log.Find("qa", "unknown"))
}

func TestAuditLog_Cap(t *testing.T) {
	log := NewAuditLog()
	for i := 0; i < auditCapPerKey+20; i++ {
		log.Record(RefSwitch{Time: time.Now(), Environment: "qa", Application: "app", NewRef: strconv.Itoa(i)})
	}
	records := log.Find("qa", "app")
	assert.Len(t, records, auditCapPerKey)
	assert.Equal(t, strconv.Itoa(auditCapPerKey+19), records[0].NewRef)
}

func TestAuditLog_AgePurgeAndFindAll(t *testing.T) {
	log := NewAuditLog()
	now := time.Now()
	log.Record(RefSwitch{Time: now.Add(-auditMaxAge - time.Hour), Environment: "qa", Application: "app", NewRef: "stale"})
	log.Record(RefSwitch{Time: now.Add(-time.Hour), Environment: "qa", Application: "app", NewRef: "older"})
	log.Record(RefSwitch{Time: now, Environment: "prod", Application: "app", NewRef: "newest"})

	records := log.Find("qa", "app")
	assert.Len(t, records, 1)
	assert.Equal(t, "older", records[0].NewRef)

	all := log.FindAll()
	assert.Len(t, all, 2)
	assert.Equal(t, "newest", all[0].NewRef)
	assert.Equal(t, "older", all[1].NewRef)
}
