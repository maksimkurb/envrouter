package envrouter

import (
	"strconv"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestAuditLog_NewestFirstAndScoped(t *testing.T) {
	log := NewAuditLog()
	log.Record(RefSwitch{Environment: "qa", Application: "app", NewRef: "first"})
	log.Record(RefSwitch{Environment: "qa", Application: "app", NewRef: "second"})
	log.Record(RefSwitch{Environment: "prod", Application: "app", NewRef: "other"})

	records := log.Find("qa", "app")
	assert.Len(t, records, 2)
	assert.Equal(t, "second", records[0].NewRef)
	assert.Equal(t, "first", records[1].NewRef)
	assert.Empty(t, log.Find("qa", "unknown"))
}

func TestAuditLog_Cap(t *testing.T) {
	log := NewAuditLog()
	for i := 0; i < auditCapPerKey+20; i++ {
		log.Record(RefSwitch{Environment: "qa", Application: "app", NewRef: strconv.Itoa(i)})
	}
	records := log.Find("qa", "app")
	assert.Len(t, records, auditCapPerKey)
	assert.Equal(t, strconv.Itoa(auditCapPerKey+19), records[0].NewRef)
}
