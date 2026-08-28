export type GenieLanguage = "English" | "Sinhala" | "Singlish";

export type GenieProduct = {
  category: string;
  currency: string;
  description: string;
  id: string;
  imageUrl: string;
  name: string;
  price: number;
  stock: number;
  stockLabel: string;
  eta: string;
  url: string;
};

export type GenieChatMessage = {
  content: string;
  retryContext?: boolean;
  retryReason?: "timeout";
  retryText?: string;
  role: "assistant" | "user";
  variant?: "context-panel";
};

export type GenieProfile = {
  budget: string;
  category: string;
  city: string;
  date: string;
  interests: string;
  occasion: string;
  recipient: string;
};

export type GenieMode = {
  icon: string;
  name: string;
};
