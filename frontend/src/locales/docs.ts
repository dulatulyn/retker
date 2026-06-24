// Auto-managed namespace for the "docs" surface.
export const docs = {
  ru: {
    // Docs.tsx — общие подписи
    'docs.copy': 'копировать',
    'docs.search.placeholder': 'Поиск по докам…',
    'docs.openProduct': 'Открыть продукт',
    'docs.sidebar.title': 'Документация',

    // Docs.tsx — оглавление (toc)
    'docs.nav.intro': 'Введение',
    'docs.nav.quickstart': 'Быстрый старт',
    'docs.nav.ingest': 'Приём событий',
    'docs.nav.schema': 'Формат события',
    'docs.nav.detectors': 'Детекторы',
    'docs.nav.ai': 'AI-аналитик',
    'docs.nav.nl': 'Запросы словами',
    'docs.nav.api': 'REST API',

    // Docs.tsx — шапка main
    'docs.title': 'Документация',
    'docs.lead':
      'retker это центр защиты данных: принимает поток событий, находит угрозы и объясняет их на русском. Ниже описано, как подключить источники и работать с API.',

    // Docs.tsx — раздел Введение
    'docs.section.intro.title': 'Введение',
    'docs.section.intro.p1':
      'retker работает на уровне логов: вы отправляете события из своих систем (входы, доступ к данным, транзакции, письма), а платформа прогоняет их через детекторы и AI-слой и возвращает приоритизированные инциденты.',
    'docs.section.intro.p2':
      'LLM-провайдер абстрагирован: модель является деталью конфигурации, а не частью контракта.',

    // Docs.tsx — раздел Быстрый старт
    'docs.section.quickstart.title': 'Быстрый старт',
    'docs.section.quickstart.p1.before': 'Приём событий авторизуется заголовком ',
    'docs.section.quickstart.p1.after':
      '). Отправьте первое событие:',
    'docs.section.quickstart.p1.demo': ' (демо-ключ: ',
    'docs.section.quickstart.p2':
      'В ответ придёт событие с присвоенным риском и, если сработали детекторы, ссылкой на инцидент:',
    'docs.code.ingestResponse.title': '200 OK · IngestOut',

    // Docs.tsx — раздел Приём событий
    'docs.section.ingest.title': 'Приём событий',
    'docs.section.ingest.p1.before':
      'Четыре типизированные двери (access / transaction / data / email) приводятся к единому формату ',
    'docs.section.ingest.p1.middle': '. Авторизация заголовком ',
    'docs.section.ingest.p1.after':
      '. Источники шлют логи сюда, как в SIEM — агенты на машинах не нужны.',

    // Docs.tsx — раздел Формат события
    'docs.section.schema.title': 'Формат события (CanonicalEvent)',
    'docs.section.schema.p1':
      'Любой источник нормализуется в единый формат, наш мини-OCSF. Конверт одинаков для транзакций, сетевых потоков, URL и активности пользователя.',
    'docs.code.schema.title': 'CanonicalEvent · JSON',

    // Docs.tsx — раздел Детекторы
    'docs.section.detectors.title': 'Детекторы',
    'docs.section.detectors.p1':
      'Детекторы это плагины. Каждый закрывает один вектор атаки трека AI Shield:',
    'docs.section.detectors.item1': 'Несанкц. доступ: impossible travel, брутфорс, новые устройства',
    'docs.section.detectors.item2': 'Аномалии (UEBA): z-score / IsolationForest на профиле поведения',
    'docs.section.detectors.item3': 'Утечки (DLP): ИИН, карты (Луна), секреты, энтропия',
    'docs.section.detectors.item4': 'Фишинг: анализ домена + LLM-вердикт по тексту',

    // Docs.tsx — раздел AI-аналитик
    'docs.section.ai.title': 'AI-аналитик',
    'docs.section.ai.p1.before':
      'Над детекторами работает AI-слой: единая обученная модель ',
    'docs.section.ai.p1.after':
      ' (ROC-AUC 0.98 по векторам) скорит события, а LLM-агент объясняет, склеивает события в инцидент и отвечает на русском. Провайдеры за абстракцией с фолбеком: Gemini → OpenAI → Anthropic → детерминированные шаблоны.',
    'docs.section.ai.p2.before': 'В чате LLM сам вызывает модель как инструмент (',
    'docs.section.ai.p2.middle': ') и опирается на реальные события — поле ',
    'docs.section.ai.p2.after': ' в ответе показывает, что было вызвано:',
    'docs.code.chatRequest.title': 'POST /v1/chat · тело запроса',
    'docs.code.chatResponse.title': 'ответ (trace показывает вызов модели)',

    // Docs.tsx — раздел Запросы словами
    'docs.section.nl.title': 'Запросы словами',
    'docs.section.nl.p1': 'Спросите свою безопасность на естественном языке:',
    'docs.code.nlQuery.title': 'POST /v1/query',
    'docs.section.nl.p2': 'LLM строит фильтр через tool-use, исполняет его и возвращает резюме.',

    // Docs.tsx — раздел REST API
    'docs.section.api.title': 'REST API',
    'docs.table.method': 'Метод',
    'docs.table.path': 'Путь',
    'docs.table.desc': 'Описание',

    // Docs.tsx — описания эндпоинтов
    'docs.endpoint.login': 'Вход → JWT-токен для дашборда',
    'docs.endpoint.access': 'Событие входа (login)',
    'docs.endpoint.transaction': 'Транзакция (фрод / отмыв)',
    'docs.endpoint.data': 'Доступ / выгрузка данных (DLP)',
    'docs.endpoint.email': 'Письмо со ссылками (фишинг)',
    'docs.endpoint.overview': 'KPI, график, разбивка по угрозам',
    'docs.endpoint.incidents': 'Список инцидентов',
    'docs.endpoint.incidentDetails': 'Детали инцидента (таймлайн, гипотеза)',
    'docs.endpoint.block': 'Заблокировать сессию / отозвать доступ',
    'docs.endpoint.query': 'NL-запрос по логам → выборка событий',
    'docs.endpoint.chat': 'AI-аналитик: LLM-агент + обученная модель',
    'docs.endpoint.report': 'Отчёт об инциденте (md / docx / xlsx)',
    'docs.endpoint.timeseries': 'События по времени (для графика)',
    'docs.endpoint.stream': 'SSE-поток алертов в реальном времени',
  } as Record<string, string>,

  kk: {
    // Docs.tsx — общие подписи
    'docs.copy': 'көшіру',
    'docs.search.placeholder': 'Құжаттамадан іздеу…',
    'docs.openProduct': 'Өнімді ашу',
    'docs.sidebar.title': 'Құжаттама',

    // Docs.tsx — оглавление (toc)
    'docs.nav.intro': 'Кіріспе',
    'docs.nav.quickstart': 'Жұмысты бастау',
    'docs.nav.ingest': 'Оқиғаларды қабылдау',
    'docs.nav.schema': 'Оқиға форматы',
    'docs.nav.detectors': 'Детекторлар',
    'docs.nav.ai': 'AI-талдаушы',
    'docs.nav.nl': 'Сөзбен сұраныстар',
    'docs.nav.api': 'REST API',

    // Docs.tsx — шапка main
    'docs.title': 'Құжаттама',
    'docs.lead':
      'retker — деректерді қорғау орталығы: оқиғалар ағынын қабылдайды, қауіптерді табады және оларды түсінікті тілмен түсіндіреді. Төменде дереккөздерді қалай қосу және API-мен қалай жұмыс істеу керектігі сипатталған.',

    // Docs.tsx — раздел Введение
    'docs.section.intro.title': 'Кіріспе',
    'docs.section.intro.p1':
      'retker лог деңгейінде жұмыс істейді: сіз өз жүйелеріңізден оқиғаларды (кірулер, деректерге қол жеткізу, транзакциялар, хаттар) жібересіз, ал платформа оларды детекторлар мен AI-қабат арқылы өткізіп, басымдыққа сұрыпталған инциденттерді қайтарады.',
    'docs.section.intro.p2':
      'LLM-провайдер абстракцияланған: модель — келісімшарттың бөлігі емес, конфигурацияның бір бөлшегі.',

    // Docs.tsx — раздел Быстрый старт
    'docs.section.quickstart.title': 'Жұмысты бастау',
    'docs.section.quickstart.p1.before': 'Оқиғаларды қабылдау ',
    'docs.section.quickstart.p1.after':
      ') тақырыбымен авторизацияланады. Алғашқы оқиғаны жіберіңіз:',
    'docs.section.quickstart.p1.demo': ' (демо-кілт: ',
    'docs.section.quickstart.p2':
      'Жауап ретінде тағайындалған тәуекелі бар оқиға келеді, ал детекторлар іске қосылса — инцидентке сілтеме де келеді:',
    'docs.code.ingestResponse.title': '200 OK · IngestOut',

    // Docs.tsx — раздел Приём событий
    'docs.section.ingest.title': 'Оқиғаларды қабылдау',
    'docs.section.ingest.p1.before':
      'Төрт типтелген есік (access / transaction / data / email) бірыңғай ',
    'docs.section.ingest.p1.middle': ' форматына келтіріледі. ',
    'docs.section.ingest.p1.after':
      ' тақырыбымен авторизация. Дереккөздер логтарды осында SIEM-дегідей жібереді — машиналарда агенттер қажет емес.',

    // Docs.tsx — раздел Формат события
    'docs.section.schema.title': 'Оқиға форматы (CanonicalEvent)',
    'docs.section.schema.p1':
      'Кез келген дереккөз бірыңғай форматқа — біздің мини-OCSF-ке нормаланады. Конверт транзакциялар, желілік ағындар, URL және пайдаланушы белсенділігі үшін бірдей.',
    'docs.code.schema.title': 'CanonicalEvent · JSON',

    // Docs.tsx — раздел Детекторы
    'docs.section.detectors.title': 'Детекторлар',
    'docs.section.detectors.p1':
      'Детекторлар — плагиндер. Әрқайсысы AI Shield тректінің бір шабуыл векторын жабады:',
    'docs.section.detectors.item1':
      'Рұқсатсыз қол жеткізу: impossible travel, брутфорс, жаңа құрылғылар',
    'docs.section.detectors.item2':
      'Аномалиялар (UEBA): мінез-құлық профиліне z-score / IsolationForest',
    'docs.section.detectors.item3': 'Ағып кетулер (DLP): ЖСН, карталар (Луна), құпиялар, энтропия',
    'docs.section.detectors.item4': 'Фишинг: домен талдауы + мәтін бойынша LLM-вердикт',

    // Docs.tsx — раздел AI-аналитик
    'docs.section.ai.title': 'AI-талдаушы',
    'docs.section.ai.p1.before':
      'Детекторлардың үстінде AI-қабат жұмыс істейді: бірыңғай оқытылған модель ',
    'docs.section.ai.p1.after':
      ' (векторлар бойынша ROC-AUC 0.98) оқиғаларды скорлайды, ал LLM-агент түсіндіреді, оқиғаларды инцидентке біріктіреді және қазақша/орысша жауап береді. Провайдерлер абстракция артында фолбекпен: Gemini → OpenAI → Anthropic → детерминирленген шаблондар.',
    'docs.section.ai.p2.before': 'Чатта LLM модельді құрал ретінде өзі шақырады (',
    'docs.section.ai.p2.middle': ') және нақты оқиғаларға сүйенеді — жауаптағы ',
    'docs.section.ai.p2.after': ' өрісі не шақырылғанын көрсетеді:',
    'docs.code.chatRequest.title': 'POST /v1/chat · сұраныс денесі',
    'docs.code.chatResponse.title': 'жауап (trace модель шақыруын көрсетеді)',

    // Docs.tsx — раздел Запросы словами
    'docs.section.nl.title': 'Сөзбен сұраныстар',
    'docs.section.nl.p1': 'Өз қауіпсіздігіңізден табиғи тілмен сұраңыз:',
    'docs.code.nlQuery.title': 'POST /v1/query',
    'docs.section.nl.p2':
      'LLM tool-use арқылы сүзгі құрады, оны орындайды және түйіндемені қайтарады.',

    // Docs.tsx — раздел REST API
    'docs.section.api.title': 'REST API',
    'docs.table.method': 'Әдіс',
    'docs.table.path': 'Жол',
    'docs.table.desc': 'Сипаттама',

    // Docs.tsx — описания эндпоинтов
    'docs.endpoint.login': 'Кіру → дашборд үшін JWT-токен',
    'docs.endpoint.access': 'Кіру оқиғасы (login)',
    'docs.endpoint.transaction': 'Транзакция (фрод / ақша жылыстату)',
    'docs.endpoint.data': 'Деректерге қол жеткізу / жүктеу (DLP)',
    'docs.endpoint.email': 'Сілтемелері бар хат (фишинг)',
    'docs.endpoint.overview': 'KPI, график, қауіптер бойынша бөліну',
    'docs.endpoint.incidents': 'Инциденттер тізімі',
    'docs.endpoint.incidentDetails': 'Инцидент туралы мәліметтер (таймлайн, гипотеза)',
    'docs.endpoint.block': 'Сессияны бұғаттау / қол жеткізуді кері қайтару',
    'docs.endpoint.query': 'Логтар бойынша NL-сұраныс → оқиғалар таңдауы',
    'docs.endpoint.chat': 'AI-талдаушы: LLM-агент + оқытылған модель',
    'docs.endpoint.report': 'Инцидент туралы есеп (md / docx / xlsx)',
    'docs.endpoint.timeseries': 'Уақыт бойынша оқиғалар (график үшін)',
    'docs.endpoint.stream': 'Нақты уақыттағы алерттер SSE-ағыны',
  } as Record<string, string>,
}
