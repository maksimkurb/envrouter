# MSW (Mock Service Worker) Setup для Envrouter

## 🎯 Что сделано

В проект добавлена поддержка **MSW (Mock Service Worker)** для автономной разработки фронтенда без необходимости запуска бэкенда.

## 📁 Структура моков

```
web/src/mocks/
├── data.ts          # Мок данные для всех сущностей
├── handlers.ts      # HTTP handlers для API endpoints
├── sse.ts           # Мок для Server-Sent Events
├── browser.ts       # Конфигурация MSW для браузера
└── index.ts         # Точка входа
```

## 📊 Мок данные

### Environments (4 окружения)
- `dev` - Development
- `qa` - Quality Assurance
- `staging` - Pre-production
- `prod` - Production

### Applications (4 приложения)
- `frontend` - Frontend приложение
- `backend` - Backend API
- `auth` - Auth сервис
- `notifier` - Notification сервис

### Repositories (3 репозитория)
- `frontend-app`
- `backend-api`
- `auth-service`

### Instances & Pods

**Всего создано:**
- **13 Instances** (Deployments) в разных окружениях
- **17 InstancePods** с разными статусами:
  - ✅ Running (большинство)
  - ⏳ Pending (notifier-dev)
  - ⚠️ Running but not ready (auth-dev)

**Разные сценарии:**
1. **Multiple replicas** - frontend-prod имеет 3 реплики
2. **Pending pods** - notifier-dev в статусе Pending
3. **Not ready pods** - auth-dev запущен, но не готов
4. **Different refs** - используются разные ветки: main, develop, feature/*, hotfix/*

## 🔌 API Endpoints с моками

Все endpoints из OpenAPI спецификации замокированы:

### GET requests:
- `/api/v1/environments` - Список окружений
- `/api/v1/applications` - Список приложений
- `/api/v1/repositories` - Список репозиториев
- `/api/v1/git/refs` - Git ветки (с фильтрацией по repository)
- `/api/v1/git/repositories/:repo/commits/:sha` - Информация о коммите
- `/api/v1/refBindings` - RefBindings (с фильтрацией)
- `/api/v1/instances` - Deployments
- `/api/v1/instancePods` - Pods
- `/api/v1/credentialsSecrets` - Credentials

### POST requests:
- `/api/v1/repositories` - Создание репозитория
- `/api/v1/refBindings` - Создание/обновление binding
- `/api/v1/credentialsSecrets` - Создание секрета

### PUT requests:
- `/api/v1/applications/:name` - Обновление приложения

### DELETE requests:
- `/api/v1/repositories/:name` - Удаление репозитория
- `/api/v1/credentialsSecrets/:name` - Удаление секрета

## ⚡ Server-Sent Events (SSE)

Реализован мок для real-time обновлений:

- События отправляются каждые **5 секунд**
- Типы событий: `InstancePod`, `Instance`, `RefHead`
- Каждое событие выбирается случайно из существующих данных
- Action всегда `UPDATED` (можно расширить для `DELETED`)

## 🚀 Как использовать

### Автоматический запуск

MSW автоматически включается в **development mode**:

```bash
npm run dev
```

В консоли браузера появится:
```
🔶 MSW enabled: API requests will be mocked
```

### Отключение моков

Если нужно работать с реальным API, установите переменную окружения:

```bash
# В .env
VITE_DISABLE_MOCKS=true
```

Или измените условие в `src/index.tsx`:

```tsx
// Закомментируйте это:
if (import.meta.env.DEV) {
  // ...
}
```

## 🔧 Настройка данных

### Добавление новых данных

Отредактируйте `src/mocks/data.ts`:

```typescript
// Добавить новое окружение
export const mockEnvironments: Environment[] = [
  { name: 'dev' },
  { name: 'qa' },
  { name: 'uat' }, // новое
]

// Добавить новое приложение
export const mockApplications: Application[] = [
  // ...
  {
    name: 'payment-service',
    repositoryName: 'payment-api',
    webhook: 'https://ci.company.com/webhook/payment',
  },
]
```

### Изменение задержки сети

В `src/mocks/handlers.ts`:

```typescript
const SIMULATED_DELAY = 300 // ms
```

### Изменение частоты SSE событий

В `src/mocks/sse.ts`:

```typescript
this.intervalId = setInterval(() => {
  // ...
}, 5000) // изменить на нужное значение (ms)
```

## 📝 Сценарии тестирования

### 1. Успешные операции
Все GET/POST/PUT/DELETE операции возвращают успешные ответы по умолчанию.

### 2. Разные статусы подов
- **Running & Ready**: frontend-prod (3 реплики)
- **Running but Not Ready**: auth-dev (для тестирования проблем)
- **Pending**: notifier-dev (для отображения создающихся подов)

### 3. Разные git refs
- `main` - production ветка
- `develop` - development ветка
- `feature/*` - feature branches
- `hotfix/*` - hotfix branches

### 4. Real-time обновления
SSE события обновляют данные каждые 5 секунд:
- Обновление статуса подов
- Обновление instances
- Обновление git refs

## 🎨 Кастомизация для тестирования

### Добавить Failed pod

В `src/mocks/data.ts`:

```typescript
export const mockInstancePods: InstancePod[] = [
  // ...
  {
    name: 'backend-qa-failed-abc12',
    environment: 'qa',
    application: 'backend',
    ref: 'develop',
    commitSha: mockCommits.develop.sha,
    ready: false,
    phase: 'Failed', // Failed status
    createdTime: '2025-01-16T10:00:00Z',
    started: false,
    parents: [],
  },
]
```

### Добавить ошибку API

В `src/mocks/handlers.ts`:

```typescript
http.get('/api/v1/applications', async () => {
  await delay(SIMULATED_DELAY)

  // Симуляция ошибки (случайно или всегда)
  if (Math.random() > 0.8) {
    return HttpResponse.json(
      { error: 'Service temporarily unavailable' },
      { status: 503 }
    )
  }

  return HttpResponse.json(mockApplications)
})
```

### Добавить медленный endpoint

```typescript
http.get('/api/v1/instancePods', async () => {
  await delay(3000) // 3 секунды задержка
  return HttpResponse.json(mockInstancePods)
})
```

## 🐛 Отладка

### Просмотр перехваченных запросов

Откройте DevTools → Network:
- MSW перехватывает запросы через Service Worker
- В колонке "Size" будет отметка "(from ServiceWorker)"

### Логирование

Добавьте логи в handlers:

```typescript
http.get('/api/v1/applications', async () => {
  console.log('📡 MSW: Fetching applications')
  await delay(SIMULATED_DELAY)
  console.log('📦 MSW: Returning', mockApplications.length, 'applications')
  return HttpResponse.json(mockApplications)
})
```

### Проверка SSE

```typescript
// В src/mocks/sse.ts
private emit(event: SSEvent) {
  console.log('📨 SSE Event:', event.itemType, event.event)
  this.listeners.forEach((listener) => listener(event))
}
```

## 📚 Дополнительная информация

- [MSW Documentation](https://mswjs.io/)
- [MSW Browser Integration](https://mswjs.io/docs/integrations/browser)
- [MSW with Vite](https://mswjs.io/docs/integrations/vite)

## ✅ Что дальше?

Теперь можно:

1. **Открыть UI в браузере**: http://localhost:3000
2. **Проверить Dashboard** - увидите все замокированные данные
3. **Проверить Settings** - управление приложениями и репозиториями работает
4. **Наблюдать real-time обновления** - каждые 5 секунд приходят SSE события
5. **Начать разработку нового UI** на базе shadcn/ui с этими данными

---

**Автор**: Claude Code
**Дата**: 2025-01-24
