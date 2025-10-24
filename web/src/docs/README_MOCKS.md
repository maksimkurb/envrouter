# 🚀 Быстрый старт с моками

## Что готово

✅ **MSW настроен** - все API запросы мокируются автоматически
✅ **Реалистичные данные** - 4 окружения, 4 приложения, 17 подов
✅ **Real-time обновления** - SSE события каждые 5 секунд
✅ **Разные статусы** - Running, Pending, Not Ready поды

## Установка

```bash
cd web
npm install  # MSW автоматически инициализируется через postinstall
```

## Запуск

```bash
npm run dev
```

Откройте http://localhost:3000

В консоли браузера увидите:
```
🔶 MSW enabled: API requests will be mocked
```

## Что можно тестировать

### Dashboard (главная страница)
- ✅ Матрица: 4 приложения × 4 окружения
- ✅ Поды с разными статусами (зелёные/жёлтые/серые)
- ✅ Git ветки и коммиты
- ✅ Real-time обновления каждые 5 секунд

### Settings → Repositories
- ✅ Список репозиториев (3 штуки)
- ✅ Добавление нового репозитория
- ✅ Удаление репозитория
- ✅ Credentials management

### Settings → Applications
- ✅ Список приложений (4 штуки)
- ✅ Редактирование приложения
- ✅ Изменение webhook URL

## Моковые данные

### Окружения
- `dev`, `qa`, `staging`, `prod`

### Приложения
- `frontend`, `backend`, `auth`, `notifier`

### Интересные кейсы для проверки

1. **Multiple replicas**: `frontend-prod` имеет 3 пода
2. **Pending pod**: `notifier-dev` в статусе Pending
3. **Not ready pod**: `auth-dev` запущен но не готов
4. **Different branches**: main, develop, feature/*, hotfix/*

## Файлы

- `src/mocks/data.ts` - все мок данные
- `src/mocks/handlers.ts` - API endpoints
- `src/mocks/sse.ts` - real-time события

Полная документация: [MSW_SETUP.md](./MSW_SETUP.md)
