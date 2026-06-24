// Auto-managed namespace for the "dashboard" surface.
export const dashboard = {
  ru: {
    // Dashboard.tsx — loading / empty
    'dashboard.loading.data': 'Загрузка данных…',
    'dashboard.loading.app': 'Загрузка…',

    // Dashboard.tsx — KPI cards
    'dashboard.kpi.events24h': 'Событий за 24 ч',
    'dashboard.kpi.events24h.caption': 'по часам',
    'dashboard.kpi.openincidents': 'Открытых инцидентов',
    'dashboard.kpi.openincidents.caption': 'требуют внимания',
    'dashboard.kpi.blocked': 'Заблокировано',
    'dashboard.kpi.blocked.caption': 'через коннектор клиента',
    'dashboard.kpi.leaksprevented': 'Утечек предотвращено',
    'dashboard.kpi.leaksprevented.caption': 'перехвачено DLP',

    // Dashboard.tsx — overview panels
    'dashboard.overview.bytype': 'По типу угрозы',
    'dashboard.overview.nothreats': 'Пока нет угроз.',
    'dashboard.overview.openincidents': 'Открытые инциденты',
    'dashboard.overview.total': '{count} всего',
    'dashboard.overview.noincidents': 'Инцидентов пока нет.',

    // Dashboard.tsx — incidents view
    'dashboard.incidents.title': 'Инциденты ({count})',
    'dashboard.incidents.empty': 'Пусто',
    'dashboard.incidents.select': 'Выберите инцидент',
    'dashboard.incidents.timeline': 'Хронология',
    'dashboard.incidents.aiconclusion': 'Вывод AI-аналитика',
    'dashboard.incidents.recommendations': 'Рекомендации',
    'dashboard.incidents.blocked': 'Заблокировано',
    'dashboard.incidents.block': 'Заблокировать',
    'dashboard.incidents.genreport': 'Сгенерировать отчёт',
    'dashboard.incidents.close': 'Закрыть инцидент',
    'dashboard.incidents.blocknote': 'Блокировка отправляется в систему клиента через коннектор (IAM / файрвол) — retker не стоит в разрыве трафика.',
    'dashboard.incidents.report': 'Отчёт об инциденте',
    'dashboard.incidents.download': 'скачать .md',
    'dashboard.incidents.alerts': 'Алерты ({count})',

    // Dashboard.tsx — detectors view
    'dashboard.detectors.title': 'Детекторы',
    'dashboard.detectors.threshold': 'порог: {thr}',
    'dashboard.detectors.impossibletravel.name': 'Impossible travel',
    'dashboard.detectors.impossibletravel.cat': 'Несанкц. доступ',
    'dashboard.detectors.impossibletravel.thr': '> 900 км/ч',
    'dashboard.detectors.bruteforce.name': 'Brute-force / credential stuffing',
    'dashboard.detectors.bruteforce.cat': 'Несанкц. доступ',
    'dashboard.detectors.bruteforce.thr': '≥ 5 фейлов / 60с',
    'dashboard.detectors.newcountry.name': 'Новая страна / устройство',
    'dashboard.detectors.newcountry.cat': 'Несанкц. доступ',
    'dashboard.detectors.newcountry.thr': 'не из истории',
    'dashboard.detectors.ueba.name': 'UEBA: массовая выгрузка',
    'dashboard.detectors.ueba.cat': 'Аномалии',
    'dashboard.detectors.ueba.thr': '≥ 1000 строк / ночь',
    'dashboard.detectors.dlp.name': 'DLP: ИИН / карты / секреты',
    'dashboard.detectors.dlp.cat': 'Утечки',
    'dashboard.detectors.dlp.thr': 'checksum + Луна + энтропия',
    'dashboard.detectors.phishing.name': 'Фишинг: домен',
    'dashboard.detectors.phishing.cat': 'Фишинг',
    'dashboard.detectors.phishing.thr': 'punycode / TLD / бренд',
    'dashboard.detectors.txscoring.name': 'Скоринг транзакций',
    'dashboard.detectors.txscoring.cat': 'Фрод',
    'dashboard.detectors.txscoring.thr': 'правило-заглушка (→ ML-модель)',

    // Dashboard.tsx — settings view
    'dashboard.settings.org': 'Организация',
    'dashboard.settings.orgname': 'Название',
    'dashboard.settings.user': 'Пользователь',
    'dashboard.settings.apikey': 'API-ключ (X-Org-Key)',
    'dashboard.settings.logout': 'Выйти',

    // Dashboard.tsx — navigation
    'dashboard.nav.overview': 'Обзор',
    'dashboard.nav.incidents': 'Инциденты',
    'dashboard.nav.events': 'События',
    'dashboard.nav.detectors': 'Детекторы',
    'dashboard.nav.sources': 'Источники',
    'dashboard.nav.settings': 'Настройки',

    // Dashboard.tsx — header / chrome
    'dashboard.chrome.closemenu': 'Закрыть меню',
    'dashboard.chrome.tosite': 'На сайт',
    'dashboard.chrome.openmenu': 'Открыть меню',
    'dashboard.chrome.notifications': 'Уведомления',
    'dashboard.chrome.nonew': 'Нет новых',
    'dashboard.chrome.usermenu': 'Меню пользователя',
    'dashboard.chrome.settings': 'Настройки',
    'dashboard.chrome.logout': 'Выйти',
    'dashboard.chrome.aianalyst': 'AI-аналитик',

    // OverviewCharts.tsx
    'dashboard.charts.nodata': 'Нет данных',
    'dashboard.charts.geo': 'География угроз',
    'dashboard.charts.detectors': 'Активность детекторов',
    'dashboard.charts.scoredist': 'Распределение риск-скора',
    'dashboard.charts.topentities': 'Топ сущностей под риском',
    'dashboard.charts.unit.events': ' соб.',
    'dashboard.charts.entitymeta': '{count} соб. · риск {max}',

    // ThreatChart.tsx
    'dashboard.threatchart.title': 'События по времени',
    'dashboard.threatchart.total': 'Всего: {total}',

    // SeverityDonut.tsx
    'dashboard.severitydonut.title': 'Критичность инцидентов',
    'dashboard.severitydonut.total': 'всего',
    'dashboard.severitydonut.crit': 'Критические',
    'dashboard.severitydonut.high': 'Высокие',
    'dashboard.severitydonut.med': 'Средние',
    'dashboard.severitydonut.low': 'Низкие',
  },
  kk: {
    // Dashboard.tsx — loading / empty
    'dashboard.loading.data': 'Деректер жүктелуде…',
    'dashboard.loading.app': 'Жүктелуде…',

    // Dashboard.tsx — KPI cards
    'dashboard.kpi.events24h': '24 сағаттағы оқиғалар',
    'dashboard.kpi.events24h.caption': 'сағаттар бойынша',
    'dashboard.kpi.openincidents': 'Ашық инциденттер',
    'dashboard.kpi.openincidents.caption': 'назар аударуды қажет етеді',
    'dashboard.kpi.blocked': 'Бұғатталды',
    'dashboard.kpi.blocked.caption': 'клиент коннекторы арқылы',
    'dashboard.kpi.leaksprevented': 'Деректер ағуы болдырылмады',
    'dashboard.kpi.leaksprevented.caption': 'DLP арқылы ұсталды',

    // Dashboard.tsx — overview panels
    'dashboard.overview.bytype': 'Қауіп түрі бойынша',
    'dashboard.overview.nothreats': 'Әзірге қауіптер жоқ.',
    'dashboard.overview.openincidents': 'Ашық инциденттер',
    'dashboard.overview.total': 'барлығы {count}',
    'dashboard.overview.noincidents': 'Әзірге инциденттер жоқ.',

    // Dashboard.tsx — incidents view
    'dashboard.incidents.title': 'Инциденттер ({count})',
    'dashboard.incidents.empty': 'Бос',
    'dashboard.incidents.select': 'Инцидентті таңдаңыз',
    'dashboard.incidents.timeline': 'Хронология',
    'dashboard.incidents.aiconclusion': 'AI-талдаушы қорытындысы',
    'dashboard.incidents.recommendations': 'Ұсыныстар',
    'dashboard.incidents.blocked': 'Бұғатталды',
    'dashboard.incidents.block': 'Бұғаттау',
    'dashboard.incidents.genreport': 'Есеп жасау',
    'dashboard.incidents.close': 'Инцидентті жабу',
    'dashboard.incidents.blocknote': 'Бұғаттау клиент жүйесіне коннектор (IAM / файрвол) арқылы жіберіледі — retker трафик үзілісінде тұрмайды.',
    'dashboard.incidents.report': 'Инцидент туралы есеп',
    'dashboard.incidents.download': '.md жүктеу',
    'dashboard.incidents.alerts': 'Алерттер ({count})',

    // Dashboard.tsx — detectors view
    'dashboard.detectors.title': 'Детекторлар',
    'dashboard.detectors.threshold': 'шегі: {thr}',
    'dashboard.detectors.impossibletravel.name': 'Impossible travel',
    'dashboard.detectors.impossibletravel.cat': 'Рұқсатсыз қол жеткізу',
    'dashboard.detectors.impossibletravel.thr': '> 900 км/сағ',
    'dashboard.detectors.bruteforce.name': 'Brute-force / credential stuffing',
    'dashboard.detectors.bruteforce.cat': 'Рұқсатсыз қол жеткізу',
    'dashboard.detectors.bruteforce.thr': '≥ 5 қате / 60с',
    'dashboard.detectors.newcountry.name': 'Жаңа ел / құрылғы',
    'dashboard.detectors.newcountry.cat': 'Рұқсатсыз қол жеткізу',
    'dashboard.detectors.newcountry.thr': 'тарихта жоқ',
    'dashboard.detectors.ueba.name': 'UEBA: жаппай жүктеу',
    'dashboard.detectors.ueba.cat': 'Аномалиялар',
    'dashboard.detectors.ueba.thr': '≥ 1000 жол / түнде',
    'dashboard.detectors.dlp.name': 'DLP: ЖСН / карталар / құпиялар',
    'dashboard.detectors.dlp.cat': 'Деректер ағуы',
    'dashboard.detectors.dlp.thr': 'checksum + Луна + энтропия',
    'dashboard.detectors.phishing.name': 'Фишинг: домен',
    'dashboard.detectors.phishing.cat': 'Фишинг',
    'dashboard.detectors.phishing.thr': 'punycode / TLD / бренд',
    'dashboard.detectors.txscoring.name': 'Транзакция скорингі',
    'dashboard.detectors.txscoring.cat': 'Алаяқтық',
    'dashboard.detectors.txscoring.thr': 'уақытша ереже (→ ML-модель)',

    // Dashboard.tsx — settings view
    'dashboard.settings.org': 'Ұйым',
    'dashboard.settings.orgname': 'Атауы',
    'dashboard.settings.user': 'Пайдаланушы',
    'dashboard.settings.apikey': 'API-кілт (X-Org-Key)',
    'dashboard.settings.logout': 'Шығу',

    // Dashboard.tsx — navigation
    'dashboard.nav.overview': 'Шолу',
    'dashboard.nav.incidents': 'Инциденттер',
    'dashboard.nav.events': 'Оқиғалар',
    'dashboard.nav.detectors': 'Детекторлар',
    'dashboard.nav.sources': 'Дереккөздер',
    'dashboard.nav.settings': 'Баптаулар',

    // Dashboard.tsx — header / chrome
    'dashboard.chrome.closemenu': 'Мәзірді жабу',
    'dashboard.chrome.tosite': 'Сайтқа',
    'dashboard.chrome.openmenu': 'Мәзірді ашу',
    'dashboard.chrome.notifications': 'Хабарламалар',
    'dashboard.chrome.nonew': 'Жаңалары жоқ',
    'dashboard.chrome.usermenu': 'Пайдаланушы мәзірі',
    'dashboard.chrome.settings': 'Баптаулар',
    'dashboard.chrome.logout': 'Шығу',
    'dashboard.chrome.aianalyst': 'AI-талдаушы',

    // OverviewCharts.tsx
    'dashboard.charts.nodata': 'Дерек жоқ',
    'dashboard.charts.geo': 'Қауіптер географиясы',
    'dashboard.charts.detectors': 'Детекторлар белсенділігі',
    'dashboard.charts.scoredist': 'Тәуекел-скор таралымы',
    'dashboard.charts.topentities': 'Тәуекелдегі үздік нысандар',
    'dashboard.charts.unit.events': ' оқ.',
    'dashboard.charts.entitymeta': '{count} оқ. · тәуекел {max}',

    // ThreatChart.tsx
    'dashboard.threatchart.title': 'Оқиғалар уақыт бойынша',
    'dashboard.threatchart.total': 'Барлығы: {total}',

    // SeverityDonut.tsx
    'dashboard.severitydonut.title': 'Инциденттер критичтілігі',
    'dashboard.severitydonut.total': 'барлығы',
    'dashboard.severitydonut.crit': 'Сыни',
    'dashboard.severitydonut.high': 'Жоғары',
    'dashboard.severitydonut.med': 'Орташа',
    'dashboard.severitydonut.low': 'Төмен',
  },
}
