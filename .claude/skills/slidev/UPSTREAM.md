# Источник этого skill

Официальный skill Slidev, скопированный в репозиторий целиком.

| | |
| --- | --- |
| Источник | https://github.com/slidevjs/slidev — каталог `skills/slidev` |
| Коммит | `36063a1e3ea3afe3df333c3707ef204fc2346c7f` (2026-07-22) |
| Версия Slidev | 52.18.0 |
| Лицензия | MIT |

## Почему скопирован, а не установлен

Документация Slidev предлагает `npx skills add slidevjs/slidev`, но эта команда
ставит skill локально каждому участнику. В репозитории с несколькими авторами
на разных ОС это означает, что у всех разные (или отсутствующие) версии.

Скопированный в `.claude/skills/` skill приезжает вместе с клоном и одинаков
у всех — доустанавливать ничего не нужно.

## Как обновить

```bash
git clone --depth 1 --filter=blob:none --sparse https://github.com/slidevjs/slidev.git /tmp/slidev
cd /tmp/slidev && git sparse-checkout set skills

# из корня нашего репозитория:
rm -rf .claude/skills/slidev/references .claude/skills/slidev/SKILL.md
cp -r /tmp/slidev/skills/slidev/. .claude/skills/slidev/
```

После обновления впишите сюда новый коммит и версию Slidev, а также сверьте,
что версия `@slidev/cli` в `package.json` не разошлась с документацией skill.

**Не редактируйте `SKILL.md` и `references/` вручную** — правки потеряются при
следующем обновлении. Проектные соглашения держите в корневом `AGENTS.md`.
