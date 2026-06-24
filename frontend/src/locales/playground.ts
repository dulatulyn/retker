// Namespace for the "playground" surface:
//   ApiPlayground    -> playground.api.*
//   LiveConsole      -> playground.console.*
//   ImagePlaceholder -> playground.image.*
// Request/response code samples are real API examples and are NOT translated.
export const playground = {
  ru: {
    // ApiPlayground
    'playground.api.eyebrow': 'Открытая документация',
    'playground.api.heading': 'API, который видно',
    'playground.api.lead':
      'Один эндпоинт принимает любые события: входы, доступ к данным, почту, транзакции. Открытый формат, понятные доки. Отправьте пример прямо здесь.',
    'playground.api.send': 'Отправить',
    'playground.api.copy': 'копировать',
    'playground.api.copied': 'скопировано',
    'playground.api.response': 'Ответ',
    'playground.api.status.idle': 'ожидание',
    'playground.api.status.loading': 'выполняется…',
    'playground.api.empty': '// нажмите «Отправить», чтобы выполнить запрос и увидеть ответ retker',
    'playground.api.docsLink': 'Вся документация и REST API',

    // LiveConsole
    'playground.console.eyebrow': 'Живой разбор',
    'playground.console.heading': 'Спросите и получите ответ',
    'playground.console.lead':
      'Напечатайте вопрос или выберите пример — retker разберёт реальные демо-логи и ответит по делу.',
    'playground.console.title': 'retker · AI-аналитик',
    'playground.console.placeholder': 'спросите о своей безопасности…',
    'playground.console.send': 'Отправить',
    // tool labels
    'playground.console.tool.get_stats': 'Сводка по организации',
    'playground.console.tool.search_logs': 'Поиск по логам',
    'playground.console.tool.list_incidents': 'Список инцидентов',
    'playground.console.tool.get_incident': 'Детали инцидента',
    'playground.console.tool.get_alerts': 'Список алертов',
    'playground.console.tool.search_knowledge': 'База знаний',
    'playground.console.tool.score_transaction': 'Скоринг транзакции',
    'playground.console.tool.score_event': 'Скоринг события',
    // example prompts
    'playground.console.example.0': 'покажи входы из новых стран ночью',
    'playground.console.example.1': 'кто скачивал базу клиентов',
    'playground.console.example.2': 'утечки ИИН за неделю',
    'playground.console.example.3': 'проверь домен kaspi-bonus.xn--80a.tk',
    // fallback answers
    'playground.console.fallback.0':
      'Нашёл подозрительный вход: Алматы → Сеул за 1 минуту, это невозможная скорость (impossible travel). Аккаунт a.serik, 02:47. Рекомендую завершить сессию и запросить повторную аутентификацию.',
    'playground.console.fallback.1':
      'Пользователь m.aliyev выгрузил 14 280 записей клиентской базы в 02:14 — нетипично для его роли и времени (UEBA-аномалия).',
    'playground.console.fallback.2':
      'DLP перехватил 3 исходящих сообщения с персональными данными: ИИН ••••2945, ИИН ••••7013 и card •••• 8821 на внешние домены. Помещены в карантин.',
    'playground.console.fallback.3':
      'Домен kaspi-bonus.xn--80a.tk — фишинг: punycode-подмена под kaspi.kz, зарегистрирован 2 дня назад. За сутки 6 сотрудников получили письма с этой ссылкой.',
    'playground.console.fallback.generic':
      'Демо-бэкенд сейчас недоступен, показываю пример. В реальной системе retker отвечает по вашим логам входов, доступа к данным, почты и транзакций.',

    // ImagePlaceholder
    'playground.image.label': 'Скриншот продукта',
    'playground.image.hint': 'место под изображение',
  },
  kk: {
    // ApiPlayground
    'playground.api.eyebrow': 'Ашық құжаттама',
    'playground.api.heading': 'Көрінетін API',
    'playground.api.lead':
      'Бір эндпоинт кез келген оқиғаны қабылдайды: кірулер, деректерге қол жеткізу, пошта, транзакциялар. Ашық формат, түсінікті құжаттама. Мысалды осы жерде жіберіңіз.',
    'playground.api.send': 'Жіберу',
    'playground.api.copy': 'көшіру',
    'playground.api.copied': 'көшірілді',
    'playground.api.response': 'Жауап',
    'playground.api.status.idle': 'күту',
    'playground.api.status.loading': 'орындалуда…',
    'playground.api.empty':
      '// сұранысты орындап, retker жауабын көру үшін «Жіберу» түймесін басыңыз',
    'playground.api.docsLink': 'Толық құжаттама және REST API',

    // LiveConsole
    'playground.console.eyebrow': 'Тірі талдау',
    'playground.console.heading': 'Сұраңыз да, жауап алыңыз',
    'playground.console.lead':
      'Сұрақ теріңіз немесе мысалды таңдаңыз — retker нақты демо-логтарды талдап, нақты жауап береді.',
    'playground.console.title': 'retker · AI-талдаушы',
    'playground.console.placeholder': 'қауіпсіздігіңіз туралы сұраңыз…',
    'playground.console.send': 'Жіберу',
    // tool labels
    'playground.console.tool.get_stats': 'Ұйым бойынша жиынтық',
    'playground.console.tool.search_logs': 'Логтардан іздеу',
    'playground.console.tool.list_incidents': 'Инциденттер тізімі',
    'playground.console.tool.get_incident': 'Инцидент туралы мәлімет',
    'playground.console.tool.get_alerts': 'Дабылдар тізімі',
    'playground.console.tool.search_knowledge': 'Білім қоры',
    'playground.console.tool.score_transaction': 'Транзакция скорингі',
    'playground.console.tool.score_event': 'Оқиға скорингі',
    // example prompts
    'playground.console.example.0': 'түнде жаңа елдерден болған кірулерді көрсет',
    'playground.console.example.1': 'клиенттер базасын кім жүктеп алды',
    'playground.console.example.2': 'апта ішіндегі ЖСН ағуы',
    'playground.console.example.3': 'kaspi-bonus.xn--80a.tk доменін тексер',
    // fallback answers
    'playground.console.fallback.0':
      'Күдікті кіру таптым: Алматы → Сеул 1 минут ішінде, бұл мүмкін емес жылдамдық (impossible travel). a.serik аккаунты, 02:47. Сессияны аяқтап, қайта аутентификация сұрауды ұсынамын.',
    'playground.console.fallback.1':
      'm.aliyev пайдаланушысы 02:14-те клиенттер базасының 14 280 жазбасын жүктеп алды — оның рөлі мен уақытына тән емес (UEBA аномалиясы).',
    'playground.console.fallback.2':
      'DLP жеке деректері бар 3 шығыс хабарламаны ұстап қалды: ЖСН ••••2945, ЖСН ••••7013 және card •••• 8821 сыртқы домендерге. Карантинге орналастырылды.',
    'playground.console.fallback.3':
      'kaspi-bonus.xn--80a.tk домені — фишинг: kaspi.kz-ке punycode-алмастыру, 2 күн бұрын тіркелген. Тәулік ішінде 6 қызметкер осы сілтемесі бар хат алды.',
    'playground.console.fallback.generic':
      'Демо-бэкенд қазір қолжетімсіз, мысал көрсетіп тұрмын. Нақты жүйеде retker сіздің кіру, деректерге қол жеткізу, пошта және транзакция логтарыңыз бойынша жауап береді.',

    // ImagePlaceholder
    'playground.image.label': 'Өнім скриншоты',
    'playground.image.hint': 'сурет орны',
  },
}
