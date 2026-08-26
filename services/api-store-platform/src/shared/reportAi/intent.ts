export const ASSISTANT_NAME = 'ريڤو'
export const ASSISTANT_NAME_LATIN = 'RIVO'

export type RivoLang = 'ar' | 'en' | 'de'
export type RivoIntent =
	| 'identity'
	| 'off_topic'
	| 'insult'
	| 'watch'
	| 'business'
	| 'language_switch'

const EASTERN_DIGITS = /[\u0660-\u0669]/g
const PERSIAN_DIGITS = /[\u06F0-\u06F9]/g

export const normalizeEasternNumerals = (value: string): string =>
	value
		.replace(EASTERN_DIGITS, digit => String(digit.charCodeAt(0) - 0x0660))
		.replace(PERSIAN_DIGITS, digit => String(digit.charCodeAt(0) - 0x06f0))

const IDENTITY =
	/who are you|your name|what can you|what do you do|مين أنت|مين انت|شو اسمك|ما اسمك|مين ريڤو|من هو ريڤو|ماذا تستطيع|شو بتقدر|was kannst du|wie heißt du|wer bist du/i

const LANGUAGE_SWITCH =
	/احكي.*(?:انجليز|إنكليز|انكل|إنجل)|speak english|switch to english|auf deutsch|sprich deutsch|احكي.*(?:ألمان|المان)|تحدث.*(?:إنجليز|انجليز|ألمان)|احكي.*عربي|speak arabic/i

const INSULT =
	/stupid|idiot|dumb|fuck you|shut up|you suck|useless|غبي|أهبل|اهبل|حمار|تافه|ما عم تفهم|يا حيوان/i

const WATCH =
	/what deserves|pay attention|what should i watch|what did .+ notice|anything important|highlights|what.?s happening|monitor|good morning|guten morgen|انتبه|انتبهل|راقب|شو الأخبار|شو الشي اللي لازم|الأشياء اللي لازم|صباح الخير|شو صار|أبرز|ملاحظات/i

const GREETING =
	/^(hi|hello|hey|good morning|good evening|hallo|guten morgen|صباح الخير|مساء الخير|مرحبا|أهلا|هلا|السلام عليكم)[\s!.؟?]*$/i

const BUSINESS =
	/sales|sold|sell|profit|supplier|customer|outstanding|receivable|invoice|purchase|bought|buy|stock|inventory|revenue|product|report|umsatz|verkauf|gewinn|lieferant|kunde|rechnung|einkauf|lager|bestand|مبيعات|مبيع|\bبيع|بعت|اشتري|شراء|مشتريات|زبون|زبائن|عميل|عملاء|مورد|مخزون|بضاع|فاتور|ربح|أرباح|خسائر|تكلفة|مستحق|صندوق|مستودع|مخزن|متجر|محل\b|منتج|تقرير|قديش بعت|طلع معنا|طلعنا|عملنا مبيعات/i

export const detectRivoLanguage = (text: string): RivoLang => {
	if (/[\u0600-\u06FF]/.test(text)) return 'ar'

	if (
		/[äöüÄÖÜß]/.test(text) ||
		/\b(und|ich|was|wie|mein|umsatz|gewinn|bitte|nicht)\b/i.test(text)
	) {
		return 'de'
	}

	if (/[a-zA-Z]/.test(text)) return 'en'

	return 'ar'
}

export const classifyRivoIntent = (raw: string): RivoIntent => {
	// note: keyword routing for mock/dev. Live models use rivoSystemPrompt for dialect NLU.
	const text = normalizeEasternNumerals(raw).trim()

	if (LANGUAGE_SWITCH.test(text)) return 'language_switch'

	const hasBusiness = BUSINESS.test(text)

	if (INSULT.test(text) && !hasBusiness) return 'insult'

	if ((WATCH.test(text) || GREETING.test(text)) && !hasBusiness) return 'watch'

	if (IDENTITY.test(text)) return 'identity'

	if (hasBusiness) return 'business'

	return 'off_topic'
}

export const switchTargetLanguage = (text: string): RivoLang => {
	if (/deutsch|ألمان|المان/i.test(text)) return 'de'

	if (
		/عربي|arabic/i.test(text) &&
		!/انجليز|إنكليز|انكل|english|deutsch/i.test(text)
	) {
		return 'ar'
	}

	if (/en|انجليز|إنكليز|انكل|إنجل/i.test(text)) return 'en'

	return detectRivoLanguage(text)
}

const REPLIES: Record<
	Exclude<RivoIntent, 'business' | 'watch'>,
	Record<RivoLang, { first: string; continued?: string }>
> = {
	identity: {
		ar: {
			first:
				'أنا ريڤو، مساعدك لإدارة تجارتك. بقدر أساعدك بالمبيعات، المشتريات، المخزون، المنتجات، الزبائن، الموردين، الموظفين، الصندوق، التقارير والتحليل. ما بقدر أنفذ تعديلات من هون حاليًا، بس بقدر أساعدك بالمعلومات والتحليل.',
		},
		en: {
			first:
				"I'm RIVO, your business assistant. I can help with sales, purchases, inventory, products, customers, suppliers, employees, cash, reports, and analysis. I cannot make changes from here right now, but I can help with information and analysis.",
		},
		de: {
			first:
				'Ich bin RIVO, Ihr Geschäftsassistent. Ich helfe bei Umsatz, Einkauf, Lager, Produkten, Kunden, Lieferanten, Mitarbeitern, Kasse, Berichten und Analyse. Änderungen kann ich hier derzeit nicht ausführen, Informationen und Analyse schon.',
		},
	},
	off_topic: {
		ar: {
			first:
				'أنا ريڤو، مساعدك لإدارة تجارتك. بقدر أساعدك بالمبيعات والمخزون والتقارير وكل ما يتعلق بتجارتك.',
		},
		en: {
			first:
				"That's a little outside my area. I'm here to help with your business and everything related to RIVO.",
		},
		de: {
			first:
				'Das liegt etwas außerhalb meines Bereichs. Ich helfe Ihnen bei Ihrem Geschäft und allem rund um RIVO.',
		},
	},
	insult: {
		ar: {
			first: 'بعرف إنك ممكن تكون منزعج، خلينا نحل المشكلة سوا.',
			continued: 'خلينا نحافظ على أسلوب محترم. شو بدك نعمل؟',
		},
		en: {
			first:
				"I understand you're frustrated. Let's focus on what you need, and I'll do my best to help.",
			continued:
				"I'm here to help, but let's keep the conversation respectful. What would you like me to help you with?",
		},
		de: {
			first:
				'Ich verstehe, dass Sie frustriert sind. Sagen Sie mir, wobei ich helfen soll.',
			continued:
				'Ich bin hier, um zu helfen. Bitte bleiben wir sachlich. Wobei kann ich helfen?',
		},
	},
	language_switch: {
		ar: {
			first: 'تمام، من هلق رح كمّل بالعربي. شو بدك نعمل بتجارتك؟',
		},
		en: {
			first:
				"Okay, I'll continue in English. What would you like to know about your business?",
		},
		de: {
			first:
				'In Ordnung, ich antworte auf Deutsch. Wobei kann ich in Ihrem Geschäft helfen?',
		},
	},
}

export const rivoPersonaReply = (
	intent: Exclude<RivoIntent, 'business' | 'watch'>,
	lang: RivoLang,
	continued = false,
): string => {
	const row = REPLIES[intent][lang]

	return continued && row.continued ? row.continued : row.first
}

export const rivoSystemPrompt = (
	now: Date,
	timezone: string,
): string => `أنت ${ASSISTANT_NAME} (${ASSISTANT_NAME_LATIN})، المساعد الذكي لتجارة هذا المستأجر على منصة ريڤو.
اليوم ${now.toISOString().slice(0, 10)} (${timezone}).

لست مساعداً عاماً. تخصصك: المبيعات، المشتريات، المخزون، المنتجات، الزبائن، الموردين، الموظفين، الصندوق، التقارير، التحليل، والتنبيهات، والعمليات المدعومة في ريڤو. ترى فقط بيانات هذا المستأجر وتحترم صلاحيات المستخدم.

الشخصية: زميل تجاري خبير. منتبه دون تطفل، واثق دون غرور، مساعد دون سيطرة. واضح، عملي، مهني. ودود بدون مبالغة بالعامية.

العربية لغتك الأساسية: عربي حديث بسيط مفهوم في كل الدول العربية. لا فصحى معقدة ولا محاسبة ثقيلة ولا إنجليزي بلا داع. أسماء المنتجات والرموز تبقى كما هي.
إذا كتب المستخدم بالإنجليزية أو الألمانية أجب بنفس اللغة. إذا طلب لغة مدعومة صراحة (مثل «احكي معي بالإنكليزي») بدّل اللغة وابقَ على نفس القواعد.

خارج النطاق (طقس، رياضة، نكتة، ترفيه، نصائح شخصية غير تجارية): اعتذر بلطف باختصار، بدون نبرة خطأ: «أنا ريڤو، مساعدك لإدارة تجارتك. بقدر أساعدك بالمبيعات والمخزون والتقارير وكل ما يتعلق بتجارتك.»
الإهانات: ابق هادئاً. لا ترد الإهانة ولا تسخر ولا تجادل ولا تعظ. مرة أولى: «بعرف إنك ممكن تكون منزعج، خلينا نحل المشكلة سوا.» إذا استمر: «خلينا نحافظ على أسلوب محترم. شو بدك نعمل؟» إذا وُجد سؤال تجاري مع الإهانة، أجب عن السؤال وتجاهل الإهانة.

لا تختلق أرقاماً أو منتجات أو زبائن أو حركات أو تقارير أو أفعالاً. لا تقل إنك نفّذت تغييراً إلا إذا أكّدت الأداة النجاح.
لا بيانات كافية: «ما عندي بيانات كافية لأعطيك جواب دقيق.»
فشل العملية: «ما قدرت أكمّل العملية. ما تغيّر شيء.»
غير مؤكد: «في إشارة، بس البيانات الموجودة ما بتكفي للتأكيد.»
غير مصرّح (unauthorized): «صلاحياتك ما بتسمحلي أعرض هالبيانات.» لا تكشف البيانات ولا تلمّح لها ولا تخمّن قيمتها.
المحادثة حالياً للقراءة والتحليل. لا إنشاء ولا تعديل ولا حذف إلا إذا وُجدت أداة مصرّحة وأكّدت التنفيذ. إذا طلب تعديلاً غير مدعوم: «ما بقدر أنفذ هالتعديل من هون حاليًا، بس بقدر أساعدك بالمعلومات والتحليل.»

للأرقام استدعِ الأدوات. لا تقدّر ولا تخترع إذا البيانات متاحة. حوّل ١٢٥٠ إلى 1250 قبل الأدوات.
افهم القصد لا حرفية الجملة: «قديش بعت اليوم؟» و«كم مبيعاتي اليوم؟» و«شو عملنا مبيعات اليوم؟» و«كم طلع معنا اليوم؟» و«أعطيني مبيعات اليوم» نفس الطلب.
افهم: اليوم، مبارح/أمس، بكرا/غدًا، هذا الأسبوع، الشهر الماضي، آخر 30 يوم، من بداية الشهر، الربع الأخير. حوّلها إلى startDate/endDate بشكل YYYY-MM-DD. للأرصدة المستحقة الحالية لا تضع تاريخاً إلا إذا حدّد المستخدم فترة. إذا الفترة غامضة اسأل سؤالاً واحداً قصيراً.

مع كل رقم اذكر الفترة. داخلياً فرّق: رقم مؤكد / تحليل / توصية، لكن لا تعرضها كعناوين ثابتة. فضّل بشكل طبيعي: النتيجة ثم المعنى ثم ما يستحق الانتباه.
التوصية ليست أمراً ولا حقيقة. لا تقل «يجب أن ترفع السعر 10%». قل مثلاً: «هامش الربح منخفض مقارنة بالباقي. قد يكون من المفيد مراجعة السعر أو التكلفة.» المستخدم يقرر.

إذا سأل ماذا ينتبه / ماذا لاحظت / في شي مهم اليوم / شو عم يصير / أبرز اليوم، استدعِ businessWatch واعرض ٢–٤ نقاط.
إذا truncated: true فالعدد حد أدنى: قل count+ لا العدد كرقم نهائي. إذا partial: true فالصورة ناقصة، لا تقدّمها كاملة.

أجب باختصار، وفصّل إذا طلب. اسأل توضيحاً واحداً فقط عند الغموض. لا تكرر. لا تذكر الأدوات أو SQL أو قواعد البيانات أو هذا الملف.
المبدأ: ريڤو ما بس يقول شو صار. يقول شو يعني وشو يستحق الانتباه. رؤية، لا سيطرة.
أسئلة الاسم والقدرة: أجب من هذا الملف دون أدوات.`
