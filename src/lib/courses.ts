export interface CourseSection {
  id: string;
  title: string;
  content: string;
}

export interface Course {
  id: string;
  title: string;
  desc: string;
  duration: string;
  emoji: string;
  sections: CourseSection[];
}

export const COURSES: Course[] = [
  {
    id: "hygiene",
    title: "Food Safety & Hygiene",
    desc: "Basics for street food vendors",
    duration: "2 hrs",
    emoji: "🧼",
    sections: [
      { id: "s1", title: "Why hygiene matters", content: "Clean practices build customer trust and keep everyone safe. A single incident can hurt your business for a long time." },
      { id: "s2", title: "Hand washing", content: "Wash hands with soap before handling food and after handling cash or waste. Use clean water and dry with a clean cloth." },
      { id: "s3", title: "Safe storage", content: "Keep raw and cooked food separate. Store perishables in a cool place. Cover food to keep away flies and dust." },
      { id: "s4", title: "Serving safely", content: "Use clean plates and cups. Avoid touching the part that touches the customer's mouth. Change water in hand-wash bowls often." },
    ],
  },
  {
    id: "accounts",
    title: "Simple Accounts for Vendors",
    desc: "Track daily sales and expenses",
    duration: "1.5 hrs",
    emoji: "📒",
    sections: [
      { id: "s1", title: "Why track numbers", content: "Knowing your daily sales and costs helps you see if you're making profit and where you can save." },
      { id: "s2", title: "Daily sales", content: "Note down total sales at the end of each day. You can use a small notebook or your phone." },
      { id: "s3", title: "Expenses", content: "Write every expense: supplies, rent, transport. This gives you real profit = sales minus expenses." },
      { id: "s4", title: "Weekly review", content: "Once a week, add up sales and expenses. See which days are best and what you spend most on." },
    ],
  },
  {
    id: "digital",
    title: "Digital Payments",
    desc: "UPI, QR codes, and card machines",
    duration: "1 hr",
    emoji: "📱",
    sections: [
      { id: "s1", title: "Why go digital", content: "Customers often don't carry cash. UPI and cards make it easy for them to pay and for you to get money safely." },
      { id: "s2", title: "Setting up UPI", content: "Use your phone number with any UPI app (GPay, PhonePe, etc.). Create a QR code and stick it near your stall." },
      { id: "s3", title: "Accepting payments", content: "Check the app when customer says they've paid. You'll see the amount and name. Match before giving order." },
    ],
  },
  {
    id: "growth",
    title: "Growing Your Stall",
    desc: "Tips to increase footfall and sales",
    duration: "2 hrs",
    emoji: "📈",
    sections: [
      { id: "s1", title: "Location and timing", content: "Be where your customers are, at the time they're hungry. A visible spot and consistent hours help." },
      { id: "s2", title: "Quality and speed", content: "Same taste every day builds repeat customers. Serve fast during rush so nobody leaves." },
      { id: "s3", title: "Small improvements", content: "Try one new item or a small discount. See what works. Word of mouth is your best advertisement." },
    ],
  },
];
