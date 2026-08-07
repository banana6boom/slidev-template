# Опциональная точка входа для тех, кто привык к make.
#
# Канонический путь — pnpm (работает везде, ничего не требует):
#   pnpm slides 01-demo
#
# Здесь только вызовы npm-скриптов, без собственной логики: правила о том,
# что такое презентация, живут в scripts/shared.mjs и больше нигде.
#
# На Windows make не входит в комплект — потребуется отдельная установка
# (Chocolatey, scoop, MSYS2 или WSL). Поэтому это дополнение, а не замена pnpm.
#
# Оба синтаксиса работают:
#   make slides 01-demo
#   make slides NAME=01-demo

PM := pnpm

# Известные команды. Всё остальное в командной строке считается аргументом.
KNOWN := help slides list new build build-all export check lint fix format clean

# Аргументы — цели, которых нет в списке известных
ARGS := $(filter-out $(KNOWN),$(MAKECMDGOALS))
NAME ?= $(firstword $(ARGS))

# Опечатку в команде ловим на этапе разбора, до запуска целей.
# Без этой проверки правило-заглушка ниже проглотило бы неизвестную цель,
# и make завершился бы с кодом 0, ничего не сделав.
ifneq ($(firstword $(MAKECMDGOALS)),)
ifeq ($(filter $(firstword $(MAKECMDGOALS)),$(KNOWN)),)
$(error Неизвестная команда «$(firstword $(MAKECMDGOALS))». Доступные: $(KNOWN))
endif
endif

.DEFAULT_GOAL := help

# Аргументы помечаем как PHONY, иначе файл или папка с таким же именем
# перехватит цель и make скажет «up to date», ничего не запустив.
.PHONY: $(KNOWN) $(ARGS)

help:
	@echo ''
	@echo 'Презентации на Slidev'
	@echo ''
	@echo '  make list                  список презентаций'
	@echo '  make slides <имя>          запустить (dev-сервер на :3030; занят — следующий)'
	@echo '  make new <имя>             создать новую презентацию'
	@echo '  make build <имя>           собрать одну презентацию'
	@echo '  make build-all             собрать все в dist/'
	@echo '  make export <имя>          экспортировать в PDF'
	@echo ''
	@echo '  make check                 все проверки качества'
	@echo '  make lint                  проверка кода'
	@echo '  make fix                   автоисправление кода и форматирование слайдов'
	@echo '  make format                форматирование слайдов'
	@echo '  make clean                 удалить результаты сборки'
	@echo ''
	@echo 'Имя можно передать и так:  make slides NAME=01-demo'
	@echo 'Свой заголовок новой презентации задаётся только через pnpm (--title)'
	@echo ''

list:
	@$(PM) slides:list

slides:
	@$(if $(NAME),,$(error Не указана презентация. Пример: make slides 01-demo))
	@$(PM) slides $(NAME)

new:
	@$(if $(NAME),,$(error Не указано имя. Пример: make new 02-basics))
	@$(PM) slides:new $(NAME)

build:
	@$(if $(NAME),,$(error Не указана презентация. Пример: make build 01-demo))
	@$(PM) build $(NAME)

build-all:
	@$(PM) build:all

export:
	@$(if $(NAME),,$(error Не указана презентация. Пример: make export 01-demo))
	@$(PM) export $(NAME)

check:
	@$(PM) check

lint:
	@$(PM) lint

fix:
	@$(PM) fix

format:
	@$(PM) format

clean:
	@$(PM) clean

# Заглушка для аргументов: они уже разобраны выше как NAME.
# Срабатывает только после известной команды — неизвестную отсекает $(error).
$(ARGS):
	@:
