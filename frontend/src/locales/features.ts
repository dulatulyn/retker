// Auto-managed namespace for the "features" surface.
export const features = {
  ru: {
    // Features.tsx — BentoFeatures
    'features.bento.eyebrow': 'Возможности',
    'features.bento.title': 'Не просто алерты, а понятные инциденты',
    'features.bento.desc':
      'Четыре вектора атак и AI-слой, который собирает события в инцидент и объясняет его понятным языком — что произошло и что делать.',
    'features.bento.ai.title': 'AI-аналитик',
    'features.bento.ai.desc': 'Объясняет каждую угрозу понятным языком и ссылается на конкретные события.',
    'features.bento.ai.question': 'почему этот вход опасен?',
    'features.bento.ai.answer':
      'Вход из Сеула через минуту после Алматы, это невозможная скорость. Риск:',
    'features.bento.ai.risk': 'высокий',
    'features.bento.access.title': 'Несанкц. доступ',
    'features.bento.access.desc': 'Impossible travel, брутфорс, новые устройства.',
    'features.bento.access.from': 'Алматы',
    'features.bento.access.to': 'Сеул · 1 мин',
    'features.bento.anomaly.title': 'Аномалии (UEBA)',
    'features.bento.anomaly.desc': 'Замечаем нетипичное поведение.',
    'features.bento.dlp.title': 'Утечки (DLP)',
    'features.bento.dlp.desc': 'ИИН, карты и секреты в исходящем.',
    'features.bento.dlp.iin': 'ИИН ••••2945',
    'features.bento.dlp.card': 'card •••• 8821',
    'features.bento.phishing.title': 'Фишинг',
    'features.bento.phishing.desc': 'Поддельные домены и кража учёток.',
    'features.bento.nl.title': 'Запросы словами',
    'features.bento.nl.desc': 'Спросите свою безопасность на естественном языке, без SQL и фильтров.',
    'features.bento.nl.placeholder': 'покажи входы из новых стран ночью',
    'features.bento.nl.q1': 'кто скачивал базу клиентов',
    'features.bento.nl.q2': 'утечки ИИН за неделю',
    'features.bento.nl.q3': 'брутфорс на админку',

    // Features.tsx — AltSplit rows
    'features.altsplit.stream.title': 'Один поток для всех событий',
    'features.altsplit.stream.desc':
      'Логи входов, доступа к данным, транзакций и почты приходят в retker через единый эндпоинт, без агентов на машинах.',
    'features.altsplit.react.title': 'Реакция в один клик',
    'features.altsplit.react.desc':
      'Заблокируйте сессию или отзовите токены прямо из инцидента и сразу получите готовый отчёт для регулятора.',

    // Features.tsx — SurfaceCards
    'features.surface.eyebrow': 'Платформа',
    'features.surface.title': 'Глубина без теней',
    'features.surface.desc': 'Слои интерфейса различаются яркостью поверхности, как у Framer.',
    'features.surface.collect.title': 'Сбор',
    'features.surface.collect.desc': 'События стекаются в единый формат',
    'features.surface.analyze.title': 'Анализ',
    'features.surface.analyze.desc': 'Правила + модель + LLM находят угрозу',
    'features.surface.react.title': 'Реакция',
    'features.surface.react.desc': 'Блок, отчёт, эскалация',

    // FeatureSplits.tsx
    'features.split.ai.eyebrow': 'AI-аналитик',
    'features.split.ai.title': 'Объясняет каждую угрозу понятным языком',
    'features.split.ai.desc':
      'retker не сыпет сырыми алертами, он расследует за вас: собирает историю атаки, оценивает риск и пишет вывод понятным языком.',
    'features.split.ai.point1': 'Склейка событий в один инцидент',
    'features.split.ai.point2': 'Таймлайн + гипотеза атаки',
    'features.split.ai.point3': 'Оценка риска и рекомендация',
    'features.split.ai.img': 'AI-аналитик: разбор инцидента',
    'features.split.react.eyebrow': 'Реакция',
    'features.split.react.title': 'Блокировка и отчёт в один клик',
    'features.split.react.desc':
      'Остановите угрозу прямо из карточки инцидента и получите готовый документ для службы безопасности и регулятора.',
    'features.split.react.point1': 'Блок сессии / отзыв доступа',
    'features.split.react.point2': 'Отчёт и СПО для регулятора',
    'features.split.react.point3': 'Запросы к данным словами',
    'features.split.react.img': 'Поток событий и запросы словами',

    // HowItWorks.tsx
    'features.how.eyebrow': 'Как это работает',
    'features.how.title': 'От сырого лога до реакции за секунды',
    'features.how.step1.title': 'Подключите источники',
    'features.how.step1.desc':
      'Логи входов, доступа к данным, транзакций и почты приходят через один эндпоинт. Без агентов на машинах.',
    'features.how.step2.title': 'Детекторы и AI находят угрозы',
    'features.how.step2.desc':
      'Правила и модели ловят подозрительное, а LLM объясняет, оценивает риск и склеивает события в инциденты.',
    'features.how.step3.title': 'Реагируйте и отчитывайтесь',
    'features.how.step3.desc':
      'Заблокируйте сессию в один клик и получите готовый отчёт об инциденте в формате для регулятора.',

    // Pricing.tsx
    'features.pricing.eyebrow': 'Тарифы',
    'features.pricing.title': 'Простые планы',
    'features.pricing.popular': 'Популярный',
    'features.pricing.start.name': 'Старт',
    'features.pricing.start.note': 'для пилота',
    'features.pricing.start.f1': '1 источник логов',
    'features.pricing.start.f2': 'Базовые детекторы',
    'features.pricing.start.f3': 'AI-объяснения',
    'features.pricing.start.f4': 'Сообщество',
    'features.pricing.start.cta': 'Начать',
    'features.pricing.team.name': 'Команда',
    'features.pricing.team.note': 'в месяц',
    'features.pricing.team.f1': 'До 10 источников',
    'features.pricing.team.f2': 'UEBA + DLP + фишинг',
    'features.pricing.team.f3': 'NL-запросы',
    'features.pricing.team.f4': 'Отчёты PDF',
    'features.pricing.team.f5': 'Приоритетная поддержка',
    'features.pricing.team.cta': 'Запустить демо',
    'features.pricing.enterprise.name': 'Enterprise',
    'features.pricing.enterprise.price': 'Договорная',
    'features.pricing.enterprise.note': 'on-premise',
    'features.pricing.enterprise.f1': 'Безлимит источников',
    'features.pricing.enterprise.f2': 'Свой LLM-провайдер',
    'features.pricing.enterprise.f3': 'SAML/SSO',
    'features.pricing.enterprise.f4': 'SLA 24/7',
    'features.pricing.enterprise.f5': 'Внедрение под ключ',
    'features.pricing.enterprise.cta': 'Связаться',

    // Testimonials.tsx
    'features.testimonials.eyebrow': 'Отзывы',
    'features.testimonials.title': 'Команды, которые уже спят спокойнее',
    'features.testimonials.q1.text':
      'Раньше на разбор инцидента уходил час. Теперь retker сам собирает историю атаки и пишет вывод, остаётся только нажать «заблокировать».',
    'features.testimonials.q1.name': 'А. Беримбаев',
    'features.testimonials.q1.role': 'SOC-аналитик, банк',
    'features.testimonials.q2.text':
      'Объяснения на русском это то, чего не хватало. Не надо расшифровывать сырые логи перед руководством.',
    'features.testimonials.q2.name': 'Д. Сулейменова',
    'features.testimonials.q2.role': 'Head of Security',
    'features.testimonials.q3.text':
      'Развернули за вечер, без агентов на машинах. Поток логов пошёл сразу.',
    'features.testimonials.q3.name': 'Т. Нурлан',
    'features.testimonials.q3.role': 'DevSecOps',
  } as Record<string, string>,
  kk: {
    // Features.tsx — BentoFeatures
    'features.bento.eyebrow': 'Мүмкіндіктер',
    'features.bento.title': 'Жай ғана алерттер емес, түсінікті инциденттер',
    'features.bento.desc':
      'Шабуылдың төрт векторы және оқиғаларды инцидентке жинап, оны түсінікті тілмен түсіндіретін AI-қабат — не болғаны және не істеу керегі.',
    'features.bento.ai.title': 'AI-талдаушы',
    'features.bento.ai.desc': 'Әрбір қауіпті түсінікті тілмен түсіндіреді және нақты оқиғаларға сілтеме жасайды.',
    'features.bento.ai.question': 'бұл кіру неге қауіпті?',
    'features.bento.ai.answer':
      'Алматыдан кейін бір минуттан соң Сеулден кіру, бұл мүмкін емес жылдамдық. Тәуекел:',
    'features.bento.ai.risk': 'жоғары',
    'features.bento.access.title': 'Рұқсатсыз кіру',
    'features.bento.access.desc': 'Impossible travel, брутфорс, жаңа құрылғылар.',
    'features.bento.access.from': 'Алматы',
    'features.bento.access.to': 'Сеул · 1 мин',
    'features.bento.anomaly.title': 'Аномалиялар (UEBA)',
    'features.bento.anomaly.desc': 'Әдеттен тыс әрекетті байқаймыз.',
    'features.bento.dlp.title': 'Деректер ағуы (DLP)',
    'features.bento.dlp.desc': 'ЖСН, карталар және құпиялар шығыс трафикте.',
    'features.bento.dlp.iin': 'ЖСН ••••2945',
    'features.bento.dlp.card': 'card •••• 8821',
    'features.bento.phishing.title': 'Фишинг',
    'features.bento.phishing.desc': 'Жалған домендер және тіркелгі деректерін ұрлау.',
    'features.bento.nl.title': 'Сөзбен сұраулар',
    'features.bento.nl.desc': 'Өз қауіпсіздігіңізден SQL мен сүзгілерсіз, табиғи тілмен сұраңыз.',
    'features.bento.nl.placeholder': 'түнде жаңа елдерден кірулерді көрсет',
    'features.bento.nl.q1': 'клиенттер базасын кім жүктеді',
    'features.bento.nl.q2': 'апта ішіндегі ЖСН ағулары',
    'features.bento.nl.q3': 'админ панеліне брутфорс',

    // Features.tsx — AltSplit rows
    'features.altsplit.stream.title': 'Барлық оқиғаларға бірыңғай ағын',
    'features.altsplit.stream.desc':
      'Кірулер, деректерге қол жеткізу, транзакциялар мен пошта логтары retker-ге бірыңғай эндпоинт арқылы, машиналарда агенттерсіз келеді.',
    'features.altsplit.react.title': 'Бір рет басумен ден қою',
    'features.altsplit.react.desc':
      'Сессияны бұғаттаңыз немесе токендерді инциденттен тікелей кері қайтарып алыңыз да, реттеуші үшін дайын есепті бірден алыңыз.',

    // Features.tsx — SurfaceCards
    'features.surface.eyebrow': 'Платформа',
    'features.surface.title': 'Көлеңкесіз тереңдік',
    'features.surface.desc': 'Интерфейс қабаттары Framer-дегідей бет жарықтығымен ажыратылады.',
    'features.surface.collect.title': 'Жинау',
    'features.surface.collect.desc': 'Оқиғалар бірыңғай форматқа ағылады',
    'features.surface.analyze.title': 'Талдау',
    'features.surface.analyze.desc': 'Ережелер + модель + LLM қауіпті табады',
    'features.surface.react.title': 'Ден қою',
    'features.surface.react.desc': 'Бұғаттау, есеп, эскалация',

    // FeatureSplits.tsx
    'features.split.ai.eyebrow': 'AI-талдаушы',
    'features.split.ai.title': 'Әрбір қауіпті түсінікті тілмен түсіндіреді',
    'features.split.ai.desc':
      'retker шикі алерттерді шашпайды, ол сіздің орныңызға тергейді: шабуыл тарихын жинайды, тәуекелді бағалайды және қорытындыны түсінікті тілмен жазады.',
    'features.split.ai.point1': 'Оқиғаларды бір инцидентке біріктіру',
    'features.split.ai.point2': 'Таймлайн + шабуыл гипотезасы',
    'features.split.ai.point3': 'Тәуекелді бағалау және ұсыныс',
    'features.split.ai.img': 'AI-талдаушы: инцидентті талдау',
    'features.split.react.eyebrow': 'Ден қою',
    'features.split.react.title': 'Бір рет басумен бұғаттау және есеп',
    'features.split.react.desc':
      'Қауіпті инцидент картасынан тікелей тоқтатыңыз да, қауіпсіздік қызметі мен реттеуші үшін дайын құжатты алыңыз.',
    'features.split.react.point1': 'Сессияны бұғаттау / қол жеткізуді кері қайтару',
    'features.split.react.point2': 'Реттеуші үшін есеп пен хабарлама',
    'features.split.react.point3': 'Деректерге сөзбен сұраулар',
    'features.split.react.img': 'Оқиғалар ағыны және сөзбен сұраулар',

    // HowItWorks.tsx
    'features.how.eyebrow': 'Бұл қалай жұмыс істейді',
    'features.how.title': 'Шикі логтан ден қоюға дейін бірнеше секундта',
    'features.how.step1.title': 'Дереккөздерді қосыңыз',
    'features.how.step1.desc':
      'Кірулер, деректерге қол жеткізу, транзакциялар мен пошта логтары бір эндпоинт арқылы келеді. Машиналарда агенттерсіз.',
    'features.how.step2.title': 'Детекторлар мен AI қауіптерді табады',
    'features.how.step2.desc':
      'Ережелер мен модельдер күдіктіні ұстайды, ал LLM түсіндіреді, тәуекелді бағалайды және оқиғаларды инциденттерге біріктіреді.',
    'features.how.step3.title': 'Ден қойыңыз және есеп беріңіз',
    'features.how.step3.desc':
      'Сессияны бір рет басумен бұғаттаңыз да, реттеуші форматындағы дайын инцидент есебін алыңыз.',

    // Pricing.tsx
    'features.pricing.eyebrow': 'Тарифтер',
    'features.pricing.title': 'Қарапайым жоспарлар',
    'features.pricing.popular': 'Танымал',
    'features.pricing.start.name': 'Старт',
    'features.pricing.start.note': 'пилот үшін',
    'features.pricing.start.f1': '1 лог дереккөзі',
    'features.pricing.start.f2': 'Негізгі детекторлар',
    'features.pricing.start.f3': 'AI-түсіндірмелер',
    'features.pricing.start.f4': 'Қауымдастық',
    'features.pricing.start.cta': 'Бастау',
    'features.pricing.team.name': 'Команда',
    'features.pricing.team.note': 'айына',
    'features.pricing.team.f1': '10 дереккөзге дейін',
    'features.pricing.team.f2': 'UEBA + DLP + фишинг',
    'features.pricing.team.f3': 'NL-сұраулар',
    'features.pricing.team.f4': 'PDF есептер',
    'features.pricing.team.f5': 'Басым қолдау',
    'features.pricing.team.cta': 'Демо іске қосу',
    'features.pricing.enterprise.name': 'Enterprise',
    'features.pricing.enterprise.price': 'Келісімді',
    'features.pricing.enterprise.note': 'on-premise',
    'features.pricing.enterprise.f1': 'Шексіз дереккөздер',
    'features.pricing.enterprise.f2': 'Өз LLM-провайдеріңіз',
    'features.pricing.enterprise.f3': 'SAML/SSO',
    'features.pricing.enterprise.f4': 'SLA 24/7',
    'features.pricing.enterprise.f5': 'Кілтке дейін енгізу',
    'features.pricing.enterprise.cta': 'Байланысу',

    // Testimonials.tsx
    'features.testimonials.eyebrow': 'Пікірлер',
    'features.testimonials.title': 'Қазірден тыныш ұйықтайтын командалар',
    'features.testimonials.q1.text':
      'Бұрын инцидентті талдауға бір сағат кететін. Енді retker шабуыл тарихын өзі жинап, қорытынды жазады, тек «бұғаттау» батырмасын басу қалады.',
    'features.testimonials.q1.name': 'А. Беримбаев',
    'features.testimonials.q1.role': 'SOC-талдаушы, банк',
    'features.testimonials.q2.text':
      'Орысша түсіндірмелер дәл осы жетіспейтін нәрсе еді. Басшылық алдында шикі логтарды талдаудың қажеті жоқ.',
    'features.testimonials.q2.name': 'Д. Сулейменова',
    'features.testimonials.q2.role': 'Head of Security',
    'features.testimonials.q3.text':
      'Бір кеште, машиналарда агенттерсіз орналастырдық. Логтар ағыны бірден кетті.',
    'features.testimonials.q3.name': 'Т. Нурлан',
    'features.testimonials.q3.role': 'DevSecOps',
  } as Record<string, string>,
}
