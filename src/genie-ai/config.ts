import type {
  ChatMessage,
  ContextDraft,
  ContextField,
  IconName,
  Language,
  SuggestedPrompt,
} from "./types";

export const modes = [
  { name: "Smart Shopping", icon: "cart" },
  { name: "Gift Box Builder", icon: "gift" },
  { name: "Product Compare", icon: "search" },
  { name: "Gift Message", icon: "heart" },
  { name: "Delivery Prediction", icon: "truck" },
  { name: "Profile", icon: "person" },
] satisfies Array<{ icon: IconName; name: string }>;

export const starterMessages: ChatMessage[] = [
  {
    role: "assistant",
    content:
      "Hello! ආයුබෝවන්! Ayubowan! I am GenieAI. 💫 Tell me what you are looking for, and I will guide the gift details. 😊",
  },
];

export const starterChips = [
  "Find a gift",
  "Find a cake",
  "Find flowers",
  "Find chocolates",
  "Find perfume",
];

export const PRODUCT_BATCH_SIZE = 4;
export const MAX_RANKED_PRODUCTS = 12;

export const starterChipGiftTypes: Record<string, string> = {
  "Find a cake": "Cakes",
  "Find chocolates": "Chocolate",
  "Find flowers": "Flowers",
  "Find perfume": "Perfumes",
};

export const languageOptions: Language[] = ["English", "Sinhala", "Singlish"];

export const languageLabels: Record<Language, string> = {
  English: "English",
  Sinhala: "සිංහල",
  Singlish: "Singlish",
};

export const starterMessagesByLanguage: Record<Language, ChatMessage[]> = {
  English: starterMessages,
  Sinhala: [
    {
      role: "assistant",
      content:
        "Ayubowan! මම GenieAI. 💫 ඔබට අවශ්‍ය gift එක කියන්න, මම ඔයාව guide කරන්නම්. 😊",
    },
  ],
  Singlish: [
    {
      role: "assistant",
      content:
        "Ayubowan! Mama GenieAI. 💫 Oyata ona gift eka kiyanna, mama oyawa guide karannam. 😊",
    },
  ],
};

export const modeIcons: Record<string, IconName> = {
  "Gift Box Builder": "gift",
  "Gift Message": "heart",
  "Product Compare": "search",
  "Smart Shopping": "cart",
  Profile: "person",
  "Delivery Prediction": "truck",
};

export const budgetOptions = [
  "Under Rs. 2,500",
  "Rs. 2,500 - 5,000",
  "Rs. 5,000 - 10,000",
  "Above Rs. 10,000",
  "Other",
];

export const guidedModeBudgetOptions = [
  "Under Rs. 5,000",
  "Rs. 5,000 - 10,000",
  "Rs. 10,000 - 20,000",
  "Above Rs. 20,000",
  "Other",
];

export const recipientOptions = ["Male", "Female", "Child", "Couple", "Other"];

export const occasionOptions = [
  "Birthday",
  "Anniversary",
  "Wedding",
  "Graduation",
  "Other",
];

export const giftTypeOptions = [
  "Flowers",
  "Cakes",
  "Chocolate",
  "Perfumes",
  "Fashion",
  "Other",
];

export const eventTypeOptions = [
  "Birthday",
  "Anniversary",
  "Office party",
  "Family gathering",
];

export const participantOptions = [
  "Under 10",
  "10 - 25",
  "25 - 50",
  "Above 50",
];

export const venueOptions = ["Home", "Office", "Hotel", "Outdoor"];

export const itemCountOptions = ["2 items", "3 items", "4 items", "5+ items"];

export const shoppingContextFields: ContextField[] = [
  "budget",
  "recipient",
  "occasion",
  "category",
];

export function getContextFieldsForMode(mode: string): ContextField[] {
  if (mode.includes("Event")) {
    return ["eventType", "participants", "venue", "budget"];
  }

  if (mode.includes("Gift Box")) {
    return ["boxRecipient", "itemCount", "budget"];
  }

  return shoppingContextFields;
}

export const contextQuestions: Record<
  Language,
  Partial<Record<ContextField, string>>
> = {
  English: {
    boxRecipient: "Who is this gift box for?",
    budget: "What is your budget?",
    category: "Gift type?",
    eventType: "What type of event are you planning?",
    itemCount: "How many items?",
    occasion: "What is the occasion?",
    participants: "How many participants?",
    recipient: "Who is the recipient?",
    venue: "Where will the event happen?",
  },
  Sinhala: {
    budget: "ඔබගේ budget එක කීයද?",
    occasion: "මොන අවස්ථාවකටද?",
    recipient: "තෑග්ග ලැබෙන්නේ කාටද?",
  },
  Singlish: {
    boxRecipient: "Gift box eka kaatada?",
    budget: "Budget eka keeyada?",
    category: "Gift type eka?",
    eventType: "Event type eka?",
    itemCount: "Box ekata items keeyak oneda?",
    occasion: "Occasion eka?",
    participants: "Keedenek enawada?",
    recipient: "Gift eka kaatada?",
    venue: "Event eka koheda thiyenne?",
  },
};

export const contextQuestionOverrides: Record<
  Language,
  Partial<Record<ContextField, string>>
> = {
  English: {},
  Sinhala: {
    boxRecipient: "මෙම gift box එක කාටද?",
    category: "Gift type එක මොකක්ද?",
    eventType: "Event එක මොකක්ද?",
    itemCount: "Box එකට items කීයක් දාන්නද?",
    participants: "Participants කී දෙනෙක් ඉන්නවද?",
    venue: "Event එක තියෙන්නේ කොහෙද?",
  },
  Singlish: {
    boxRecipient: "Gift box eka kaatada?",
    category: "Gift type eka?",
    eventType: "Event type eka?",
    itemCount: "Box ekata items keeyak oneda?",
    participants: "Keedenek enawada?",
    venue: "Event eka koheda thiyenne?",
  },
};

export const giftTypeMessages: Record<Language, string> = {
  English: "Thanks. What type of gift would you like to explore?",
  Sinhala: "ස්තුතියි. ඔබ බලන්න කැමති තෑගි වර්ගය තෝරන්න.",
  Singlish: "Thanks. mokak wage gift type ekak balannada?",
};

export const contextFieldOptions: Record<ContextField, string[]> = {
  boxRecipient: recipientOptions,
  budget: budgetOptions,
  category: giftTypeOptions,
  eventType: eventTypeOptions,
  itemCount: itemCountOptions,
  occasion: occasionOptions,
  participants: participantOptions,
  recipient: recipientOptions,
  venue: venueOptions,
};

export function getContextFieldOptionsForMode(
  mode: string,
): Record<ContextField, string[]> {
  if (mode.includes("Event") || mode.includes("Gift Box")) {
    return { ...contextFieldOptions, budget: guidedModeBudgetOptions };
  }

  return contextFieldOptions;
}

export const contextFieldLabels: Record<ContextField, string> = {
  boxRecipient: "Recipient",
  budget: "Budget",
  category: "Gift type",
  eventType: "Event type",
  itemCount: "Items",
  occasion: "Occasion",
  participants: "Participants",
  recipient: "Recipient",
  venue: "Venue",
};

export const contextFieldLabelsByLanguage: Record<
  Language,
  Record<ContextField, string>
> = {
  English: contextFieldLabels,
  Sinhala: {
    boxRecipient: "Recipient",
    budget: "Budget",
    category: "Gift type",
    eventType: "Event type",
    itemCount: "Items",
    occasion: "Occasion",
    participants: "Participants",
    recipient: "Recipient",
    venue: "Venue",
  },
  Singlish: {
    boxRecipient: "Recipient",
    budget: "Budget",
    category: "Gift type",
    eventType: "Event type",
    itemCount: "Items",
    occasion: "Occasion",
    participants: "Participants",
    recipient: "Recipient",
    venue: "Venue",
  },
};

export const contextFieldLabelOverrides: Record<
  Language,
  Partial<Record<ContextField, string>>
> = {
  English: {},
  Sinhala: {
    boxRecipient: "ලබන්නා",
    budget: "Budget",
    category: "Gift type",
    eventType: "Event type",
    itemCount: "Items",
    occasion: "අවස්ථාව",
    participants: "Participants",
    recipient: "ලබන්නා",
    venue: "ස්ථානය",
  },
  Singlish: {
    boxRecipient: "Recipient",
    budget: "Budget",
    category: "Gift type",
    eventType: "Event type",
    itemCount: "Items",
    occasion: "Occasion",
    participants: "Participants",
    recipient: "Recipient",
    venue: "Venue",
  },
};

export const emptyContextDraft: ContextDraft = {
  boxRecipient: "",
  budget: "",
  category: "",
  eventType: "",
  itemCount: "",
  occasion: "",
  participants: "",
  recipient: "",
  venue: "",
};

export const copy: Record<
  Language,
  Partial<{
    active: string;
    addProducts: string;
    addToBuyBox: string;
    allContextDetected: string;
    askPlaceholder: string;
    buyBox: string;
    checkout: string;
    city: string;
    clearHistory: string;
    comparePrompt: string;
    continueWithoutContext: string;
    contextIntro: string;
    contextTitle: string;
    createOrderLink: string;
    date: string;
    detectedContext: string;
    delivery: string;
    deliveryInstructions: string;
    eventPrompt: string;
    giftBoxPrompt: string;
    giftMessageLabel: string;
    initialEmpty: string;
    initialLoading: string;
    imageLooksLike: string;
    language: string;
    modes: string;
    openCheckout: string;
    processing: string;
    productView: string;
    recipientName: string;
    recipientPhone: string;
    relatedGiftsReply: string;
    recordingVoice: string;
    send: string;
    sendContext: string;
    sending: string;
    sendingContext: string;
    senderName: string;
    subtotal: string;
    transcribingVoice: string;
    total: string;
    uploadingImage: string;
    useContextCard: string;
    userContext: string;
    voicePause: string;
    voiceEnglishOnly: string;
    voiceRetry: string;
    voiceResume: string;
    voiceStop: string;
  }>
> = {
  English: {
    active: "Active",
    addProducts: "Add products to build a cart order link.",
    addToBuyBox: "Add to Cart",
    allContextDetected: "All needed context was detected from your message.",
    askPlaceholder:
      "Ask Genie to search, compare, plan an event, or checkout...",
    buyBox: "Cart",
    checkout: "Delivery address",
    city: "City",
    clearHistory: "Clear history",
    comparePrompt:
      "Enter 2 or 3 product IDs and I will compare them in a table.",
    continueWithoutContext: "Skip",
    contextIntro:
      "I detected details from your message and only need anything missing before answering it.",
    contextTitle: "Set shopping preferences",
    createOrderLink: "Create Order Link",
    date: "Date",
    detectedContext: "Detected preferences",
    delivery: "Delivery",
    deliveryInstructions: "Delivery instructions",
    eventPrompt: "Let us plan the event. Add the event details below.",
    giftBoxPrompt: "Let us build the gift box. Add the gift box details below.",
    giftMessageLabel: "Gift message",
    initialEmpty: "GenieAI products will appear here after a search.",
    initialLoading: "Loading products...",
    imageLooksLike: "Your image looks like",
    language: "Language",
    modes: "Agent Modes",
    openCheckout: "Open Checkout",
    processing: "Processing...",
    productView: "View",
    recipientName: "Recipient name",
    recipientPhone: "Recipient phone",
    relatedGiftsReply: "I will show you related gifts.",
    recordingVoice: "Recording voice input...",
    send: "Send",
    sendContext: "Send Preferences",
    sending: "Sending",
    sendingContext: "Sending Preferences",
    senderName: "Sender name",
    subtotal: "Subtotal",
    transcribingVoice: "Transcribing voice note...",
    total: "Total",
    uploadingImage: "Processing image...",
    useContextCard: "Use the preferences above...",
    userContext: "Preferences",
    voicePause: "Pause",
    voiceEnglishOnly: "Voice search supports English only.",
    voiceRetry:
      "I couldn't clearly recognize that voice message. Please try again in English.",
    voiceResume: "Resume",
    voiceStop: "Stop",
  },
  Sinhala: {
    active: "Active",
    addProducts: "Order එකකට products එකතු කරන්න.",
    addToBuyBox: "Cart එකට එකතු කරන්න",
    allContextDetected: "ඔබගේ message එකෙන් අවශ්‍ය context හමු වුණා.",
    askPlaceholder: "Genieගෙන් search, compare, plan, checkout අහන්න...",
    buyBox: "Cart",
    checkout: "Delivery address",
    city: "නගරය",
    continueWithoutContext: "මඟ හරින්න",
    contextIntro:
      "ඔබගේ message එකෙන් හමු වූ details පාවිච්චි කරලා, අඩු දේවල් විතරක් අහනවා.",
    contextTitle: "Shopping preferences තෝරන්න",
    createOrderLink: "Create Order Link",
    date: "දිනය",
    detectedContext: "හමු වූ preferences",
    delivery: "Delivery",
    deliveryInstructions: "Delivery instructions",
    initialEmpty: "සෙවීමට පස්සේ GenieAI products මෙතැන පෙන්වයි.",
    initialLoading: "Products load වෙනවා...",
    language: "භාෂාව",
    modes: "Agent Modes",
    openCheckout: "Open Checkout",
    productView: "බලන්න",
    recipientName: "Recipient name",
    recipientPhone: "Recipient phone",
    send: "යවන්න",
    sendContext: "Preferences යවන්න",
    sending: "යවමින්",
    sendingContext: "Preferences යවමින්",
    senderName: "Sender name",
    subtotal: "Subtotal",
    total: "Total",
    useContextCard: "ඉහළ preferences භාවිත කරන්න...",
    userContext: "Preferences",
  },
  Singlish: {
    active: "Active",
    addProducts: "Order ekak hadanna products add karanna.",
    addToBuyBox: "Cart ekata add karanna",
    allContextDetected: "Oyage message eken preferences detect una.",
    askPlaceholder: "Genie gen search, compare, plan, checkout ahanna...",
    buyBox: "Cart",
    checkout: "Delivery address",
    city: "City eka",
    clearHistory: "History clear karanna",
    comparePrompt:
      "Product IDs 2k hari 3k hari denna. Mama table ekakin compare karannam.",
    continueWithoutContext: "Skip",
    contextIntro: "Oyage message eken details detect kala.",
    contextTitle: "Shopping preferences set karanna",
    createOrderLink: "Create Order Link",
    date: "Date eka",
    detectedContext: "Detected preferences",
    delivery: "Delivery",
    deliveryInstructions: "Delivery instructions",
    eventPrompt: "Event eka plan karamu. Pahala details tika denna.",
    giftBoxPrompt: "Gift box eka hadamu. Pahala details tika denna.",
    giftMessageLabel: "Gift message",
    initialEmpty: "Seweemakata passe GenieAI products methana pennanawa.",
    initialLoading: "Products load wenawa...",
    language: "Language",
    modes: "Agent Modes",
    openCheckout: "Open Checkout",
    productView: "Balanna",
    recipientName: "Recipient name",
    recipientPhone: "Recipient phone",
    relatedGiftsReply: "Mama oyata related gifts pennannam.",
    send: "Send",
    sendContext: "Preferences send karanna",
    sending: "Sending",
    sendingContext: "Preferences sending",
    senderName: "Sender name",
    subtotal: "Subtotal",
    total: "Total",
    useContextCard: "Uda preferences use karanna...",
    userContext: "Preferences",
  },
};

export const copyOverrides: Record<
  Language,
  Partial<Required<(typeof copy)["English"]>>
> = {
  English: {},
  Sinhala: {
    addProducts: "Order එකක් හදන්න products එකතු කරන්න.",
    addToBuyBox: "Cart එකට එකතු කරන්න",
    buyBox: "Cart",
    clearHistory: "History clear කරන්න",
    comparePrompt:
      "Product IDs 2ක් හෝ 3ක් දෙන්න. මම table එකකින් compare කරන්නම්.",
    contextIntro: "ඔබ දුන් details අනුව අඩු තොරතුරු ටික පමණක් තෝරන්න.",
    contextTitle: "Preferences තෝරන්න",
    eventPrompt: "Event එක plan කරමු. පහළ details ටික තෝරන්න.",
    giftBoxPrompt: "Gift box එක හදමු. පහළ details ටික තෝරන්න.",
    deliveryInstructions: "Delivery instructions",
    giftMessageLabel: "Gift message",
    imageLooksLike: "ඔබේ image එක පේන්නේ",
    processing: "Processing...",
    recordingVoice: "Voice record වෙනවා...",
    relatedGiftsReply: "මම ඔබට ගැලපෙන gifts පෙන්වන්නම්.",
    transcribingVoice: "Voice note එක text කරනවා...",
    uploadingImage: "Image process වෙනවා...",
    useContextCard: "ඉහළ preferences භාවිතා කරන්න...",
    userContext: "Preferences",
    voicePause: "Pause",
    voiceEnglishOnly: "Voice search සඳහා සහාය දක්වන්නේ English පමණයි.",
    voiceRetry:
      "Voice message එක පැහැදිලිව හඳුනාගන්න බැරි වුණා. කරුණාකර English වලින් නැවත උත්සාහ කරන්න.",
    voiceResume: "Resume",
    voiceStop: "Stop",
  },
  Singlish: {
    deliveryInstructions: "Delivery instructions",
    giftMessageLabel: "Gift message",
    imageLooksLike: "Oyage image eka penenne",
    processing: "Processing...",
    recordingVoice: "Voice record wenawa...",
    transcribingVoice: "Voice note eka text karanawa...",
    uploadingImage: "Image process wenawa...",
    voicePause: "Pause",
    voiceEnglishOnly: "Voice search support karanne English witharai.",
    voiceRetry:
      "Voice message eka hariyata handunaganna bari una. English walin aye try karanna.",
    voiceResume: "Resume",
    voiceStop: "Stop",
  },
};

export const suggestedPromptsByLanguage: Record<Language, SuggestedPrompt[]> = {
  English: [
    {
      action: "fill",
      text: "Show me chocolate cakes between Rs. 2500 - 5000 for my girlfriend's birthday.",
    },
    {
      action: "fill",
      text: "Can you deliver to Colombo tomorrow?",
    },
  ],
  Sinhala: [
    {
      action: "fill",
      text: "මගේ පෙම්වතියගේ උපන්දිනයට Rs. 2500 - 5000 අතර රතු රෝස මල් පෙන්නන්න.",
    },
    {
      action: "fill",
      text: "හෙට Colombo වලට delivery කරන්න පුළුවන්ද?",
    },
  ],
  Singlish: [
    {
      action: "fill",
      text: "Mage pemwathiyage upandinayata Rs. 2500 - 5000 athara rathu rosa mal pennanna.",
    },
    {
      action: "fill",
      text: "Heta Colombo walata delivery karanna puluwanda?",
    },
  ],
};

export const starterChipLabels: Record<Language, Record<string, string>> = {
  English: {},
  Sinhala: {
    "Build a gift box": "තෑගි පෙට්ටියක් හදන්න",
    "Compare products": "නිෂ්පාදන සසඳන්න",
    "Find a gift": "තෑග්ගක් හොයන්න",
    "Plan an event": "උත්සවයක් සැලසුම් කරන්න",
    "Track an order": "ඇණවුමක් පරීක්ෂා කරන්න",
    "Write a gift message": "තෑගි පණිවිඩයක් ලියන්න",
  },
  Singlish: {
    "Build a gift box": "Gift box hadanna",
    "Compare products": "Products compare karanna",
    "Find a gift": "Gift ekak hoyanna",
    "Plan an event": "Event ekak plan karanna",
    "Track an order": "Order track karanna",
    "Write a gift message": "Gift message liyanna",
  },
};

export const starterChipOverrides: Record<Language, Record<string, string>> = {
  English: {},
  Sinhala: {
    "Find a cake": "කේක් එකක් හොයන්න",
    "Find chocolates": "චොකලට් හොයන්න",
    "Find flowers": "මල් හොයන්න",
    "Find perfume": "සුවඳ විලවුන් හොයන්න",
    "Same-day delivery": "අදම බෙදාහැරීම",
  },
  Singlish: {
    "Find a cake": "Cake ekak hoyanna",
    "Find chocolates": "Chocolate hoyanna",
    "Find flowers": "Flowers hoyanna",
    "Find perfume": "Perfume hoyanna",
    "Same-day delivery": "Ada delivery",
  },
};

export const optionLabels: Record<Language, Record<string, string>> = {
  English: {},
  Sinhala: {
    "Above Rs. 20,000": "Rs. 20,000 ට වැඩි",
    "Above Rs. 10,000": "Rs. 10,000 ට වැඩි",
    Anniversary: "\u0dc3\u0d82\u0dc0\u0dad\u0dca\u0dc3\u0dbb\u0dba",
    Birthday: "\u0d8b\u0db4\u0db1\u0dca\u0daf\u0dd2\u0db1\u0dba",
    Child: "ළමයෙක්",
    Chocolate: "\u0da0\u0ddc\u0d9a\u0dbd\u0da7\u0dca",
    Couple: "Couple",
    Cakes: "\u0d9a\u0dda\u0d9a\u0dca",
    Fashion: "Fashion",
    Female: "කාන්තාවක්",
    Flowers: "\u0db8\u0dbd\u0dca",
    Graduation:
      "\u0d8b\u0db4\u0dcf\u0db0\u0dd2 \u0db4\u0dca\u0dbb\u0daf\u0dcf\u0db1\u0dba",
    Male: "පුරුෂයෙක්",
    Other: "වෙනත්",
    Perfumes:
      "\u0dc3\u0dd4\u0dc0\u0db3 \u0dc0\u0dd2\u0dbd\u0dc0\u0dd4\u0db1\u0dca",
    "Rs. 2,500 - 5,000": "Rs. 2,500 - 5,000",
    "Rs. 5,000 - 10,000": "Rs. 5,000 - 10,000",
    "Rs. 10,000 - 20,000": "Rs. 10,000 - 20,000",
    "Under Rs. 5,000": "Rs. 5,000 ට අඩු",
    "Under Rs. 2,500": "Rs. 2,500 ට අඩු",
    Wedding: "\u0dc0\u0dd2\u0dc0\u0dcf\u0dc4\u0dba",
  },
  Singlish: {
    "Above Rs. 20,000": "Rs. 20,000 ta wedi",
    "Above Rs. 10,000": "Rs. 10,000 ta wedi",
    Anniversary: "Sanwathsare",
    Birthday: "Upandinaya",
    Child: "Child",
    Chocolate: "Chocolate",
    Couple: "Couple",
    Cakes: "Cake",
    Fashion: "Fashion",
    Female: "Female",
    Flowers: "Mal",
    Graduation: "Upadhi pradanaya",
    Male: "Male",
    Other: "Wenath",
    Perfumes: "Perfume",
    "Rs. 2,500 - 5,000": "Rs. 2,500 - 5,000",
    "Rs. 5,000 - 10,000": "Rs. 5,000 - 10,000",
    "Rs. 10,000 - 20,000": "Rs. 10,000 - 20,000",
    "Under Rs. 5,000": "Rs. 5,000 ta adu",
    "Under Rs. 2,500": "Rs. 2,500 ta adu",
    Wedding: "Vivahaya",
  },
};

export const contextOptionLabels: Record<Language, Record<string, string>> = {
  English: {},
  Sinhala: {
    "2 items": "අයිතම 2",
    "3 items": "අයිතම 3",
    "4 items": "අයිතම 4",
    "5+ items": "අයිතම 5+",
    "10 - 25": "10 - 25",
    "25 - 50": "25 - 50",
    "Above 50": "50 ට වැඩි",
    "Family gathering": "පවුලේ එකතුව",
    Home: "නිවස",
    Hotel: "හෝටලය",
    Office: "කාර්යාලය",
    "Office party": "කාර්යාල සාදය",
    Outdoor: "එළිමහන්",
    Party: "සාදය",
    Perfume: "සුවඳ විලවුන්",
    "Under 10": "10 ට අඩු",
    Wellness: "සුවතා",
  },
  Singlish: {
    "2 items": "Items 2",
    "3 items": "Items 3",
    "4 items": "Items 4",
    "5+ items": "Items 5+",
    "10 - 25": "10 - 25",
    "25 - 50": "25 - 50",
    "Above 50": "50 ta wedi",
    "Family gathering": "Family gathering",
    Home: "Home",
    Hotel: "Hotel",
    Office: "Office",
    "Office party": "Office party",
    Outdoor: "Outdoor",
    Party: "Party",
    Perfume: "Perfume",
    "Under 10": "10 ta adu",
    Wellness: "Wellness",
  },
};

export const dynamicChipLabels: Record<Language, Record<string, string>> = {
  English: {},
  Sinhala: {
    "Check delivery": "බෙදාහැරීම පරීක්ෂා කරන්න",
    Chocolate: "චොකලට්",
    "Colombo delivery": "කොළඹට බෙදාහැරීම",
    "Create order link": "ඇණවුම් සබැඳිය හදන්න",
    "More like this": "මේ වගේ තවත්",
    Perfume: "සුවඳ විලවුන්",
    Roses: "රෝස මල්",
    Watch: "ඔරලෝසුව",
  },
  Singlish: {
    "Check delivery": "Delivery check karanna",
    Chocolate: "Chocolate",
    "Colombo delivery": "Colombo delivery",
    "Create order link": "Order link hadanna",
    "More like this": "Me wage thawa",
    Perfume: "Perfume",
    Roses: "Roses",
    Watch: "Watch",
  },
};

export const commonChipLabels: Record<Language, Record<string, string>> = {
  English: {
    "Next item": "Next item",
    "Previous item": "Previous item",
    "Suggest more": "Suggest more",
  },
  Sinhala: {
    "Check delivery": "බෙදාහැරීම පරීක්ෂා කරන්න",
    Chocolate: "චොකලට්",
    "Colombo delivery": "කොළඹට බෙදාහැරීම",
    "Create order link": "ඇණවුම් සබැඳිය හදන්න",
    "More like this": "මේ වගේ තවත්",
    "Next item": "ඊළඟ අයිතමය",
    "Open checkout": "Checkout අරින්න",
    "Previous item": "පෙර අයිතමය",
    Perfume: "සුවඳ විලවුන්",
    Roses: "රෝස මල්",
    "Search more products": "තව products හොයන්න",
    "Search products": "Products හොයන්න",
    "Suggest more": "තවත් යෝජනා",
    Watch: "ඔරලෝසුව",
  },
  Singlish: {
    "Check delivery": "Delivery check karanna",
    Chocolate: "Chocolate",
    "Colombo delivery": "Colombo delivery",
    "Create order link": "Order link hadanna",
    "More like this": "Me wage thawa",
    "Next item": "Ilanga item eka",
    "Open checkout": "Open checkout",
    "Previous item": "Kalin item eka",
    Perfume: "Perfume",
    Roses: "Roses",
    "Search more products": "Thawa products hoyanna",
    "Search products": "Products hoyanna",
    "Suggest more": "Thawa yojana",
    Watch: "Watch",
  },
};

export const iconPaths: Record<IconName, string> = {
  ai: "M5 5h14v10H9l-4 4V5Zm7-1 .9 2.6 2.6.9-2.6.9L12 11l-.9-2.6-2.6-.9 2.6-.9L12 4Z",
  box: "M4 7l8-4 8 4-8 4-8-4Zm0 0v10l8 4m0-10v10m8-14v10l-8 4",
  camera: "M4 7h3l1.5-2h7L17 7h3v12H4V7Zm8 9a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  cart: "M3 4h2l2 11h10l2-7H6m2 11a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm9 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
  check: "M5 12l4 4L19 6",
  gift: "M20 12v8H4v-8m16 0H4m16 0V8H4v4m8-4v12M8 8c-2 0-3-1-3-2s1-2 2-2c2 0 5 4 5 4s3-4 5-4c1 0 2 1 2 2s-1 2-3 2",
  heart:
    "M12 20s-7-4.4-9-9c-1.2-2.8.8-5.8 3.8-5.8 1.8 0 3.1 1 4.2 2.4 1.1-1.4 2.4-2.4 4.2-2.4 3 0 5 3 3.8 5.8-2 4.6-9 9-9 9Z",
  menu: "M4 6h16M4 12h16M4 18h16",
  mic: "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Zm-7 9a7 7 0 0 0 14 0m-7 7v3m-4 0h8",
  person: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9c.8-4.2 3.5-6.5 7-6.5s6.2 2.3 7 6.5",
  plus: "M12 5v14M5 12h14",
  search: "M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Zm5.5-2 5 5",
  send: "M12 5v14m0-14-5 5m5-5 5 5",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-5v3m0 12v3M4.9 4.9 7 7m10 10 2.1 2.1M3 12h3m12 0h3M4.9 19.1 7 17m10-10 2.1-2.1",
  speaker: "M4 9v6h4l5 4V5L8 9H4Zm12 1a4 4 0 0 1 0 4m2-7a8 8 0 0 1 0 10",
  sparkles:
    "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Zm6 12 1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3ZM5 3l.8 2.2L8 6l-2.2.8L5 9l-.8-2.2L2 6l2.2-.8L5 3Z",
  truck: "M3 6h11v11H3V6Zm11 4h4l3 3v4h-7v-7ZM7 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm11 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  trash: "M4 7h16m-10 4v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3",
  x: "M6 6l12 12M18 6 6 18",
};

export const rotatingActivityMessages: Record<Language, string[]> = {
  English: [
    "Understanding your request...",
    "Checking your preferences...",
    "Searching GenieAI products...",
    "Matching the best options...",
    "Preparing your reply...",
  ],
  Sinhala: [
    "ඔබේ ඉල්ලීම තේරුම් ගනිමින්...",
    "Preferences පරීක්ෂා කරමින්...",
    "GenieAI products සොයමින්...",
    "හොඳම ගැළපීම් තෝරමින්...",
    "පිළිතුර සකස් කරමින්...",
  ],
  Singlish: [
    "Oyage request eka balamin...",
    "Preferences check karamin...",
    "GenieAI products hoyamin...",
    "Galapena options thoramin...",
    "Reply eka hadamin...",
  ],
};
