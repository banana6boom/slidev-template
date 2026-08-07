#!/usr/bin/env node
/**
 * Guard от установки чужим пакетным менеджером. Вызывается из preinstall.
 *
 * npm и yarn молча пропускают наши install-скрипты (git-хуки не встанут),
 * создают свои lock-файлы и игнорируют настройки из pnpm-workspace.yaml —
 * участник получает тихо ослабленную среду. Свой скрипт вместо only-allow:
 * без внешних зависимостей и сетевых обращений на каждой установке.
 */

import process from 'node:process'

const agent = process.env.npm_config_user_agent ?? ''

if (!agent.startsWith('pnpm')) {
  console.error('\n✖ Проект использует pnpm — установка через npm/yarn сломает git-хуки и настройки.')
  console.error('  Установите pnpm:  corepack enable   (или: npm install -g pnpm)')
  console.error('  Затем:            pnpm install\n')
  process.exit(1)
}
