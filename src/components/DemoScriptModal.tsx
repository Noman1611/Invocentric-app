import React, { useState, useEffect } from 'react';
import { 
  X, Sparkles, Check, ChevronRight, Volume2, VolumeX,
  Receipt, FileEdit, Users, CreditCard, Package, ShoppingCart, Landmark, Settings,
  Globe, Info
} from 'lucide-react';
import { cn } from '../lib/utils';

interface DemoScriptModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface GuideStep {
  id: string;
  stage: string;
  titleEn: string;
  titleHi: string;
  icon: React.ReactNode;
  route: string;
  purposeEn: string;
  purposeHi: string;
  howItWorksEn: string[];
  howItWorksHi: string[];
  tipsEn: string;
  tipsHi: string;
  speechTextEn: string;
  speechTextHi: string;
}

export default function DemoScriptModal({ isOpen, onClose }: DemoScriptModalProps) {
  const [lang, setLang] = useState<'en' | 'hi'>('en');
  const [isSpeakingId, setIsSpeakingId] = useState<string | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({});

  // Stop any playing speech on unmount or when modal is closed
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const stepsList: GuideStep[] = [
    {
      id: 'invoice',
      stage: 'STEP 1',
      titleEn: 'GST & Regular Invoices (Sales Billing)',
      titleHi: 'GST और सामान्य इनवॉइस (सेल्स बिलिंग)',
      icon: <Receipt className="text-green-600" size={20} />,
      route: '/invoices',
      purposeEn: 'Quickly create and send professional invoices, compute GST taxes, and generate payment UPI QR codes.',
      purposeHi: 'तेजी से प्रोफेशनल बिल बनाएं, GST टैक्स की गणना करें, और पेमेंट कलेक्ट करने के लिए UPI QR कोड जनरेट करें।',
      howItWorksEn: [
        'Click on "Create Invoice" from the dashboard or sidebar.',
        'Select a registered customer and add items from your inventory catalog.',
        'Apply discounts, choose tax rates (GST, SGST, IGST), or choose tax-exempt status.',
        'Generate an instant Dynamic QR Code so customers can scan and pay via GooglePay, PhonePe, or Paytm.',
        'Click save to view the beautiful bill, download as high-quality PDF, or share instantly via 1-click WhatsApp.'
      ],
      howItWorksHi: [
        'डैशबोर्ड या साइडबार से "Create Invoice" पर क्लिक करें।',
        'अपने पहले से जुड़े ग्राहक को चुनें और आइटम लिस्ट में से सामान जोड़ें।',
        'डिस्काउंट लागू करें, टैक्स रेट चुनें (जैसे GST, CGST, SGST, IGST) या टैक्स-फ्री बिल बनाएं।',
        'डायनेमिक QR कोड इनेबल करें जिससे ग्राहक GooglePay, PhonePe, या Paytm से स्कैन करके पेमेंट कर सकें।',
        'सेव बटन दबाएं, बिल को PDF में डाउनलोड करें, या 1-Click WhatsApp से सीधे ग्राहक को भेजें।'
      ],
      tipsEn: 'Pro-Tip: Switch on "Thermal Format" in settings to print quick 2-inch or 3-inch receipts for POS thermal printers.',
      tipsHi: 'प्रशंसक सलाह: POS थर्मल प्रिंटर के लिए 2-इंच या 3-इंच की रसीद निकालने के लिए सेटिंग्स में "Thermal Print" चालू करें।',
      speechTextEn: "Step 1: Sales Billing and Invoices. Create professional GST bills instantly. Select your customer, add products from stock, customize tax and discounts, and generate a dynamic QR code for instant UPI payments. Finally, download as watermark free P.D.F or share on WhatsApp with one click.",
      speechTextHi: "स्टेप १: सेल्स बिलिंग और इनवॉइस। अपनी दुकान के ग्राहकों के लिए तुरंत जीएसटी बिल बनाएं। ग्राहक का नाम और सामान चुनें, टैक्स व डिस्काउंट दर्ज करें, और यूपीआई पेमेंट के लिए क्यूआर कोड जोड़ें। आप इस बिल को बिना किसी वॉटरमार्क के पीडीएफ में डाउनलोड कर सकते हैं या वॉट्सऐप पर तुरंत भेज सकते हैं।"
    },
    {
      id: 'quotations',
      stage: 'STEP 2',
      titleEn: 'Quotations & Price Estimates',
      titleHi: 'कोटेशन और मूल्य अनुमान (Quotations)',
      icon: <FileEdit className="text-sky-600" size={20} />,
      route: '/quotations',
      purposeEn: 'Send professional price proposals to potential clients and convert them to tax invoices in a single click.',
      purposeHi: 'ग्राहकों को काम शुरू करने से पहले पक्का एस्टीमेट या कोटेशन बनाकर भेजें और डील फाइनल होने पर उसे सीधे बिल में बदलें।',
      howItWorksEn: [
        'Navigate to the "Quotations" section and click "New Quotation".',
        'Enter estimated rates, labor, and product values.',
        'Download and share the non-tax quotation PDF directly with clients.',
        'Once approved, click "Convert to Invoice" on the quotation view page to automatically transfer all details into a fresh GST bill.'
      ],
      howItWorksHi: [
        'साइडबार में "Quotations" सेक्शन में जाकर "New Quotation" पर क्लिक करें।',
        'अपेक्षित प्रोडक्ट रेट, सर्विस चार्ज और टैक्स का विवरण दर्ज करें।',
        'कोटेशन का पीडीएफ डाउनलोड करके ग्राहक को वॉट्सऐप या ईमेल पर शेयर करें।',
        'डील पक्की होने पर कोटेशन पेज पर "Convert to Invoice" पर क्लिक करें, जिससे पूरा कोटेशन ऑटोमैटिक नए जीएसटी इनवॉइस में बदल जाएगा।'
      ],
      tipsEn: 'Pro-Tip: Ideal for B2B deals, contracts, and service providers to lock in pricing agreements before final delivery.',
      tipsHi: 'प्रशंसक सलाह: सर्विस प्रोवाइडर्स और बड़े डीलर्स के लिए डील्स फाइनल करने से पहले रेट लॉक करने का सबसे आसान तरीका।',
      speechTextEn: "Step 2: Quotations and Price Estimates. Create formal business quotes and proforma invoices for your deals. When your client approves the estimate, simply open the quote and click convert to invoice to instantly generate a proper GST bill without retyping anything.",
      speechTextHi: "स्टेप २: कोटेशन और एस्टीमेट। ग्राहकों को डील फाइनल करने के लिए प्रोफेशनल रेट कार्ड या कोटेशन भेजें। जब ग्राहक कोटेशन स्वीकार कर ले, तो सिर्फ एक क्लिक में उसे इनवॉइस में बदलें। इससे आपको दोबारा पूरी एंट्री नहीं करनी पड़ेगी।"
    },
    {
      id: 'parties',
      stage: 'STEP 3',
      titleEn: 'Parties Ledger (Customers & Suppliers)',
      titleHi: 'पार्टी लेजर बहीखाता (ग्राहक और सप्लायर)',
      icon: <Users className="text-amber-600" size={20} />,
      route: '/customers',
      purposeEn: 'Keep zero-error accounting ledgers for customers who buy from you and suppliers who sell you inventory.',
      purposeHi: 'अपने खरीदार ग्राहकों और माल बेचने वाले सप्लायरों का डिजिटल लेजर खाता मेंटेन करें ताकि उधारी का हिसाब बिल्कुल सही रहे।',
      howItWorksEn: [
        'Open the "Customers & Suppliers" page and register a new party.',
        'Add details such as mobile number, GSTIN, shipping address, and opening balance (credit/due).',
        'The app automatically tracks the historic due balance of each customer as invoices and payments are recorded.',
        'Download the full transaction ledger statement (PDF or Excel) and send payment reminders on WhatsApp in one click.'
      ],
      howItWorksHi: [
        '"Customers & Suppliers" सेक्शन में जाकर नया खाता बनाएं।',
        'नाम, मोबाइल नंबर, पता और पुराना बकाया राशि (Opening Balance) दर्ज करें।',
        'जैसे ही आप नए बिल बनाएंगे या पेमेंट जमा करेंगे, पार्टी का कुल बकाया ऑटोमैटिक अपडेट होता रहेगा।',
        'आप किसी भी ग्राहक का पूरा खाता विवरण पीडीएफ या एक्सेल में डाउनलोड करके सीधे उनके वॉट्सऐप पर भेज सकते हैं।'
      ],
      tipsEn: 'Pro-Tip: Color-coded balances immediately highlight who owes you money (red) and who you owe money to (green).',
      tipsHi: 'प्रशंसक सलाह: रंग-बिरंगे बैलेंस तुरंत दिखाते हैं कि किससे पैसा लेना है (लाल रंग) और किसे पैसा चुकाना है (हरा रंग)।',
      speechTextEn: "Step 3: Parties Ledger. Register customers and wholesale suppliers. Keep a neat digital bahi-khata ledger. View dynamic outstanding balances, download full ledger reports, and send automatic payment reminders directly to client phones.",
      speechTextHi: "स्टेप ३: पार्टी लेजर और बहीखाता। ग्राहकों और थोक सप्लायरों को जोड़ें और उनका लेन-देन का हिसाब रखें। आप लाल रंग में उधारी और हरे रंग में जमा राशि देख सकते हैं, और उधारी वसूलने के लिए वॉट्सऐप रिमाइंडर भेज सकते हैं।"
    },
    {
      id: 'payments',
      stage: 'STEP 4',
      titleEn: 'Payments Received & Paid Logs',
      titleHi: 'पेमेंट रिकॉर्ड और रसीद (Payments)',
      icon: <CreditCard className="text-emerald-600" size={20} />,
      route: '/payments',
      purposeEn: 'Record advance amounts, partial customer installments, and payment modes to prevent discrepancy.',
      purposeHi: 'अग्रिम राशि (Advance), किश्तें (Installments) और पेमेंट के मोड (कैश, यूपीआई, बैंक ट्रांसफर) का पूरा लेखा-जोखा रखें।',
      howItWorksEn: [
        'When a customer makes a payment, click "Record Payment".',
        'Select the customer, type the amount received, select the payment date, and document the mode (Cash, UPI, GPay, Online).',
        'The software automatically decreases the customer\'s outstanding balance.',
        'Print or share a clean thermal payment receipt acknowledging receipt of funds.'
      ],
      howItWorksHi: [
        'जब भी कोई ग्राहक बकाया पैसा चुकाए, तो "Record Payment" पर क्लिक करें।',
        'ग्राहक का नाम, जमा की गई रकम, तारीख और पेमेंट मोड (जैसे नकद, यूपीआई, ऑनलाइन) चुनें।',
        'सॉफ्टवेयर तुरंत उस ग्राहक की कुल उधारी राशि को कम कर देगा।',
        'पेमेंट मिलने के बाद ग्राहक को उसकी डिजिटल रसीद तुरंत वॉट्सऐप पर भेजें या प्रिंट करें।'
      ],
      tipsEn: 'Pro-Tip: Tie payments to specific invoices to track which bills are fully settled or partially outstanding.',
      tipsHi: 'प्रशंसक सलाह: पेमेंट्स को खास इनवॉइस नंबर के साथ जोड़ें जिससे पता चले कि कौन सा बिल पूरा चुकता हो गया है और कौन सा अधूरा है।',
      speechTextEn: "Step 4: Payments Tracking. Record advance payments, part payments, and split payment modes like cash, card, and online. This updates the digital register instantly, ensuring accurate cash-on-hand tracking.",
      speechTextHi: "स्टेप ४: पेमेंट ट्रैकिंग। ग्राहकों से मिले पैसों या सप्लायर्स को दिए गए भुगतानों को रिकॉर्ड करें। चाहे कैश हो या ऑनलाइन, ऐप में एंट्री करते ही उधारी तुरंत कट जाती है और कैश बैलेंस बिल्कुल सही दिखाई देता है।"
    },
    {
      id: 'items',
      stage: 'STEP 5',
      titleEn: 'Items & Inventory Management',
      titleHi: 'प्रोडक्ट और स्टॉक मैनेजमेंट (Items)',
      icon: <Package className="text-green-600" size={20} />,
      route: '/items',
      purposeEn: 'Add products with selling prices, wholesale purchase prices, tax rates, and set low stock warning levels.',
      purposeHi: 'अपने सामान की लिस्ट बनाएं, सेलिंग प्राइस, खरीदी प्राइस, GST रेट और स्टॉक की चेतावनी सीमा सेट करें।',
      howItWorksEn: [
        'Go to the "Items" catalog and click "Add New Item".',
        'Enter item name, barcode, custom unit (Pcs, Box, Kg), Sale Price, Purchase Price, and GST percentage.',
        'Enter current stock on hand and specify a Minimum Stock Alert quantity.',
        'When selling, the system automatically subtracts the items and triggers a visual warning once stock goes below your specified limit.'
      ],
      howItWorksHi: [
        '"Items" सेक्शन में जाएं और "Add New Item" पर क्लिक करें।',
        'सामान का नाम, बारकोड, यूनिट (जैसे किलोग्राम, पीस, बॉक्स), बेचने का दाम, खरीदी का दाम और जीएसटी रेट दर्ज करें।',
        'स्टॉक की मात्रा और "Minimum Stock Alert" सेट करें।',
        'जैसे ही आप सामान बेचेंगे, स्टॉक अपने आप कम हो जाएगा। स्टॉक तय सीमा से कम होने पर ऐप आपको लाल अलर्ट दिखाएगा।'
      ],
      tipsEn: 'Pro-Tip: Utilize your smartphone or computer camera to scan barcodes directly for high-speed item additions and instant checkout.',
      tipsHi: 'प्रशंसक सलाह: बहुत तेजी से बिलिंग करने के लिए अपने मोबाइल कैमरे को बारकोड स्कैनर की तरह उपयोग करें और तुरंत सामान लोड करें।',
      speechTextEn: "Step 5: Items and Inventory. Set up your digital product catalog. Save item names, retail prices, purchase costs, and tax settings. Get immediate alerts when your inventory levels fall low, so you never run out of stock.",
      speechTextHi: "स्टेप ५: प्रोडक्ट और स्टॉक मैनेजमेंट। अपने सभी प्रोडक्ट्स की लिस्ट तैयार करें। बेचने और खरीदने का दाम, और जीएसटी दर्ज करें। स्टॉक खत्म होने से पहले लो-स्टॉक अलर्ट पाएं ताकि आप समय पर नया सामान मंगवा सकें।"
    },
    {
      id: 'purchases',
      stage: 'STEP 6',
      titleEn: 'Purchases (Supplier Bill Entries)',
      titleHi: 'स्टॉक परचेज (थोक खरीदी बिल)',
      icon: <ShoppingCart className="text-purple-600" size={20} />,
      route: '/purchases',
      purposeEn: 'Log wholesale purchases from suppliers to increase inventory counts and monitor raw material costs.',
      purposeHi: 'थोक विक्रेताओं या सप्लायर्स से खरीदे गए स्टॉक का बिल दर्ज करें ताकि आपका इन्वेंटरी स्टॉक खुद-ब-खुद बढ़ जाए।',
      howItWorksEn: [
        'Open the "Purchases" menu and click "Add Purchase Bill".',
        'Select the wholesale vendor and add the products purchased.',
        'Input purchase prices and tax details to update your average costing.',
        'Saving the purchase automatically increments stock levels for all included items.'
      ],
      howItWorksHi: [
        'साइडबार में "Purchases" पर जाएं और "Add Purchase Bill" पर क्लिक करें।',
        'सप्लायर का नाम चुनें और खरीदे गए सामान की लिस्ट डालें।',
        'खरीदने की कीमत और टैक्स भरें ताकि आपके मुनाफे का सही आकलन हो सके।',
        'बिल सेव करते ही स्टॉक इन्वेंटरी में सामान की मात्रा अपने आप बढ़ जाएगी।'
      ],
      tipsEn: 'Pro-Tip: Registering purchases is crucial to correctly compute your Business Gross Profits and audit-ready stock levels.',
      tipsHi: 'प्रशंसक सलाह: सही मुनाफा और स्टॉक की वैल्यू जानने के लिए सप्लायर से मिले हर खरीदी बिल को ऐप में जरूर दर्ज करें।',
      speechTextEn: "Step 6: Wholesale Purchases. Record purchase bills from vendors. Logging your purchase costs automatically adds products back into your inventory stock and maintains your supplier credit balances.",
      speechTextHi: "स्टेप ६: थोक खरीदी बिल। सप्लायर्स से खरीदे गए माल के बिल को ऐप में डालें। इससे आपकी दुकान का स्टॉक अपने आप बढ़ जाएगा और सप्लायर की उधारी का हिसाब भी दर्ज रहेगा।"
    },
    {
      id: 'expenses',
      stage: 'STEP 7',
      titleEn: 'Business Expense Tracker',
      titleHi: 'बिजनेस खर्चे और व्यय (Expenses)',
      icon: <Landmark className="text-rose-600" size={20} />,
      route: '/expenses',
      purposeEn: 'Keep tabs on miscellaneous expenses like rent, office utilities, salaries, and tea to calculate absolute Net Profit.',
      purposeHi: 'दुकान के रोजाना के अन्य फुटकर खर्चे जैसे किराया, बिजली का बिल, स्टाफ की सैलरी और चाय-पानी का हिसाब रखें।',
      howItWorksEn: [
        'Go to "Expenses" and click "Add Expense Entry".',
        'Assign a category (e.g., Rent, Office Stationery, Tea & Snacks, Transport).',
        'Enter total amount, payment method (Cash, Bank), and write a quick reference note.',
        'All logged expenses are instantly subtracted from gross income in your Profit & Loss analytics.'
      ],
      howItWorksHi: [
        '"Expenses" सेक्शन में जाकर "Add Expense Entry" पर क्लिक करें।',
        'खर्चे की कैटेगरी चुनें (जैसे दुकान किराया, बिजली बिल, सैलरी, चाय-नाश्ता या डिलीवरी चार्ज)।',
        'रकम दर्ज करें, पेमेंट मोड चुनें और कोई जरूरी टिप्पणी लिखें।',
        'ये सारे खर्चे आपके कुल मुनाफे (Profit & Loss Report) में से ऑटोमैटिक घट जाएंगे।'
      ],
      tipsEn: 'Pro-Tip: Keeping expenses organized prevents missing cash-leaks and optimizes business taxation deduction benefits.',
      tipsHi: 'प्रशंसक सलाह: नियमित रूप से छोटे-छोटे खर्चे लिखने से गल्ले (कैश बॉक्स) की गड़बड़ी दूर होती है और वास्तविक कमाई का पता चलता है।',
      speechTextEn: "Step 7: Expense Tracker. Log operating expenses such as rent, salaries, transport, and utilities. Keeping tabs on non inventory expenses is essential for calculating your true net business profit.",
      speechTextHi: "स्टेप ७: बिजनेस खर्चे। दुकान के बाकी सभी छोटे-बड़े खर्चे जैसे किराया, बिजली बिल, सैलरी और चाय-पानी दर्ज करें। इससे आपको अपनी दुकान की शुद्ध कमाई और असली नेट प्रॉफिट का पता चलेगा।"
    },
    {
      id: 'reports',
      stage: 'STEP 8',
      titleEn: 'Reports & Dynamic Settings',
      titleHi: 'रिपोर्ट्स और मुख्य सेटिंग्स (Reports)',
      icon: <Settings className="text-slate-700" size={20} />,
      route: '/reports',
      purposeEn: 'Export tax-compliant GST data, Sales reports, Profit & Loss summaries, and manage print sizes.',
      purposeHi: 'GST टैक्स समरी, सेल्स रिपोर्ट, और डेली कैश बुक एक्सेल या पीडीएफ में डाउनलोड करें, और प्रिंट साइज बदलें।',
      howItWorksEn: [
        'Open the "Reports" center to view real-time graphical charts representing Sales, Profit/Loss, and Expenses.',
        'Use custom date-filters (Today, This Month, Financial Year) to audit your finances.',
        'Export reports in 1-click to Microsoft Excel or download detailed PDF summary sheets.',
        'Navigate to "Settings" to upload your brand logo, configure custom terms & conditions, set up cloud sync, or select A4 / 3-inch thermal bill size.'
      ],
      howItWorksHi: [
        '"Reports" सेंटर खोलकर सेल्स, मुनाफा और खर्चे की वास्तविक रिपोर्ट सुंदर ग्राफ और चार्ट्स के साथ देखें।',
        'तारीख के फिल्टर (आज, इस महीने, या पूरा साल) की मदद से अपनी दुकान के खातों का मिलान करें।',
        'एक क्लिक में पूरी रिपोर्ट एक्सेल या पीडीएफ में एक्सपोर्ट करें ताकि सीए को भेजने में आसानी हो।',
        'मुख्य सेटिंग्स में जाकर अपनी दुकान का लोगो अपलोड करें, नियमों व शर्तों को कस्टमाइज़ करें और प्रिंटर साइज़ चुनें।'
      ],
      tipsEn: 'Pro-Tip: Review your "Daily Cash Book" every evening to match the physical cash in your drawer with the digital app balance.',
      tipsHi: 'प्रशंसक सलाह: हर शाम दुकान बंद करने से पहले "Daily Cash Book" जरूर देखें और गल्ले के कैश का मिलान डिजिटल बैलेंस से करें।',
      speechTextEn: "Step 8: Reports and Settings. View real time financial charts, sales analytics, and dynamic GST reports. Export directly to Excel or P.D.F. In settings, upload your business logo, configure print formats, and sync your data securely.",
      speechTextHi: "स्टेप ८: रिपोर्ट्स और सेटिंग्स। दुकान की बिक्री, मुनाफा, और जीएसटी की पक्की रिपोर्ट चार्ट्स के साथ देखें। इन्हें एक क्लिक में एक्सेल या पीडीएफ में डाउनलोड करें। सेटिंग्स में अपनी दुकान का लोगो और रसीद का आकार कस्टमाइज करें।"
    }
  ];

  const handleSpeech = (stepId: string, text: string, langCode: 'en' | 'hi') => {
    if ('speechSynthesis' in window) {
      if (isSpeakingId === stepId) {
        // Toggle stop
        window.speechSynthesis.cancel();
        setIsSpeakingId(null);
      } else {
        window.speechSynthesis.cancel(); // Stop any current speech
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = langCode === 'hi' ? 'hi-IN' : 'en-US';
        utterance.rate = 0.92; // Slightly natural, slower pace
        utterance.pitch = 1.0;

        // Try to select a professional natural-sounding voice
        const voices = window.speechSynthesis.getVoices();
        if (langCode === 'hi') {
          const hiVoice = voices.find(v => 
            v.lang.startsWith('hi') || 
            v.name.includes('Hindi') || 
            v.name.includes('Google हिन्दी') || 
            v.name.includes('Indian')
          );
          if (hiVoice) utterance.voice = hiVoice;
        } else {
          const enVoice = voices.find(v => 
            v.lang.startsWith('en') && 
            (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Female') || v.name.includes('Samantha') || v.name.includes('Microsoft'))
          );
          if (enVoice) utterance.voice = enVoice;
        }

        utterance.onend = () => {
          setIsSpeakingId(null);
        };
        utterance.onerror = () => {
          setIsSpeakingId(null);
        };

        setIsSpeakingId(stepId);
        window.speechSynthesis.speak(utterance);
      }
    } else {
      alert("Text-to-Speech is not supported in this browser environment.");
    }
  };

  const toggleComplete = (id: string) => {
    setCompletedSteps(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto">
      {/* Container - Fully Light-Themed with Elegant Padding and Visual Rhythm. Full-screen on mobile, modal on desktop */}
      <div className="bg-[#FAF9F6] text-slate-800 w-full h-full sm:h-auto sm:max-h-[92vh] sm:rounded-3xl shadow-2xl border-0 sm:border border-slate-200/80 flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200" id="interactive-app-guide-modal">
        
        {/* Top Header Bar */}
        <div className="p-4 sm:p-6 bg-white border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 sm:p-3 bg-green-50 border border-green-200 rounded-xl sm:rounded-2xl text-green-600 shadow-xs">
              <Sparkles size={20} className="animate-pulse sm:w-6 sm:h-6" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base md:text-xl font-black tracking-tight text-slate-900 leading-tight">
                InvoCentric Interactive Product Walkthrough
              </h2>
              <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5">
                Learn how all features work with Hindi & English voice tours
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all cursor-pointer border-none bg-transparent shrink-0 active:scale-90"
            title="Close Guide"
          >
            <X size={20} />
          </button>
        </div>

        {/* Dynamic Controls Bar: Language and Progress */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-white border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
          
          {/* Dual Language Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
            <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Globe size={12} />
              Language:
            </span>
            <div className="bg-slate-100 p-0.5 sm:p-1 rounded-xl flex items-center border border-slate-200">
              <button
                onClick={() => {
                  setLang('en');
                  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
                  setIsSpeakingId(null);
                }}
                className={cn(
                  "flex-1 sm:flex-none px-2.5 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-black rounded-lg transition-all cursor-pointer border-none",
                  lang === 'en'
                    ? "bg-green-600 text-white shadow-xs"
                    : "bg-transparent text-slate-600 hover:text-slate-900"
                )}
              >
                English Tour
              </button>
              <button
                onClick={() => {
                  setLang('hi');
                  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
                  setIsSpeakingId(null);
                }}
                className={cn(
                  "flex-1 sm:flex-none px-2.5 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-black rounded-lg transition-all cursor-pointer border-none",
                  lang === 'hi'
                    ? "bg-green-600 text-white shadow-xs"
                    : "bg-transparent text-slate-600 hover:text-slate-900"
                )}
              >
                Hinglish / हिंदी
              </button>
            </div>
          </div>

          {/* Quick Progress Indicator */}
          <div className="flex items-center justify-between sm:justify-end gap-3 border-t border-slate-100 sm:border-0 pt-2 sm:pt-0">
            <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider sm:hidden">
              Your Progress:
            </span>
            <div className="text-right flex items-center gap-2">
              <div className="text-[10px] sm:text-xs font-bold text-slate-700">
                {Object.values(completedSteps).filter(Boolean).length}/{stepsList.length} Read
              </div>
              <div className="w-20 sm:w-28 bg-slate-100 h-1.5 sm:h-2 rounded-full overflow-hidden border border-slate-200">
                <div 
                  className="bg-green-500 h-full transition-all duration-300"
                  style={{ width: `${(Object.values(completedSteps).filter(Boolean).length / stepsList.length) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Modal Scrollable Content - Pure Light Theme with mathematically balanced negative spaces */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 sm:space-y-6 bg-[#FAF9F6]">
          
          {/* Welcome Intro Banner */}
          <div className="p-3.5 sm:p-4 bg-green-50/75 border border-green-200/80 rounded-xl sm:rounded-2xl flex items-start gap-2.5 sm:gap-3 shadow-xs">
            <div className="p-1.5 sm:p-2 bg-green-100 text-green-800 rounded-lg shrink-0 mt-0.5">
              <Info size={16} className="sm:w-[18px] sm:h-[18px]" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-green-950">
                {lang === 'en' ? "Welcome to your Personal App Walkthrough!" : "आपका व्यक्तिगत ऐप गाइड और ऑडियो टूर में स्वागत है!"}
              </h4>
              <p className="text-[11px] sm:text-xs text-green-900 leading-relaxed mt-1 font-medium">
                {lang === 'en' 
                  ? "We have designed this offline-first billing app to be extremely simple yet complete. Tap on the Speaker button next to any step to hear a clear audio walkthrough of that feature!"
                  : "हमने इस बिलिंग एप्लिकेशन को बहुत आसान और शक्तिशाली बनाया है। नीचे दिए गए किसी भी स्टेप के पास वाले नीले स्पीकर बटन पर क्लिक करें ताकि आप उस फीचर के बारे में स्पष्ट हिंदी/इंग्लिश आवाज में सुन सकें!"}
              </p>
            </div>
          </div>

          {/* Steps Loop */}
          <div className="space-y-4 sm:space-y-6">
            {stepsList.map((step) => {
              const isChecked = !!completedSteps[step.id];
              const isSpeaking = isSpeakingId === step.id;
              
              return (
                <div 
                  key={step.id}
                  className={cn(
                    "p-4 sm:p-5 md:p-6 bg-white border rounded-xl sm:rounded-2xl transition-all duration-300 relative group shadow-xs",
                    isChecked ? "border-slate-300 bg-slate-50/50" : "border-slate-200/90 hover:border-green-300 hover:shadow-md"
                  )}
                >
                  {/* Top line of card - Stacks elegantly on mobile */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5 mb-3.5">
                    <div className="flex items-start sm:items-center gap-2.5 sm:gap-3">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 bg-slate-100 rounded-lg sm:rounded-xl flex items-center justify-center border border-slate-200/60 shadow-inner shrink-0">
                        {step.icon}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                          <span className="text-[9px] sm:text-[10px] font-black tracking-wider text-slate-500 uppercase bg-slate-100 px-1.5 py-0.5 rounded-md">
                            {step.stage}
                          </span>
                          <span className="text-[9px] sm:text-xs font-mono font-bold text-green-700 bg-green-50 px-1.5 py-0.5 rounded-md border border-green-100">
                            Route: {step.route}
                          </span>
                        </div>
                        <h3 className="text-sm sm:text-base font-black text-slate-900 mt-1 leading-tight">
                          {lang === 'en' ? step.titleEn : step.titleHi}
                        </h3>
                      </div>
                    </div>

                    {/* Action Panel: Play Sound & Check Done (Span full width on mobile for better touch targets) */}
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      {/* Play Text-to-Speech */}
                      <button
                        onClick={() => handleSpeech(
                          step.id, 
                          lang === 'en' ? step.speechTextEn : step.speechTextHi, 
                          lang
                        )}
                        className={cn(
                          "flex-1 sm:flex-none justify-center px-3 sm:px-3.5 py-2 text-[11px] sm:text-xs font-extrabold rounded-lg sm:rounded-xl transition-all flex items-center gap-1.5 sm:gap-2 border cursor-pointer active:scale-95",
                          isSpeaking 
                            ? "bg-rose-50 border-rose-200 text-rose-700 animate-pulse" 
                            : "bg-green-50 border-green-100 text-green-700 hover:bg-green-100/60"
                        )}
                        title={isSpeaking ? "Stop Audio" : "Play Audio Tour"}
                      >
                        {isSpeaking ? <VolumeX size={14} /> : <Volume2 size={14} />}
                        <span>{isSpeaking ? (lang === 'en' ? "Stop" : "रोकें") : (lang === 'en' ? "Listen Tour" : "आवाज सुनें")}</span>
                      </button>

                      {/* Tick off step */}
                      <button
                        onClick={() => toggleComplete(step.id)}
                        className={cn(
                          "p-2 rounded-lg sm:rounded-xl border transition-all cursor-pointer shrink-0 active:scale-95",
                          isChecked 
                            ? "bg-slate-800 border-slate-800 text-white" 
                            : "bg-white border-slate-200 text-slate-400 hover:text-slate-800 hover:border-slate-300"
                        )}
                        title={isChecked ? "Mark as Unread" : "Mark as Read"}
                      >
                        <Check size={15} strokeWidth={isChecked ? 3 : 2} />
                      </button>
                    </div>
                  </div>

                  {/* Feature Purpose Statement */}
                  <p className="text-[11px] sm:text-xs text-slate-700 leading-relaxed font-bold border-l-3 border-green-500 pl-2.5 py-0.5 mb-3">
                    {lang === 'en' ? step.purposeEn : step.purposeHi}
                  </p>

                  {/* Step-by-Step Instructions */}
                  <div className="space-y-1.5 mb-3 bg-slate-50/80 p-3 sm:p-4 rounded-xl border border-slate-100/80">
                    <p className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-wider">
                      {lang === 'en' ? "How to use this feature:" : "इस फीचर का उपयोग कैसे करें:"}
                    </p>
                    <ul className="space-y-1.5 text-[11px] sm:text-xs text-slate-700">
                      {(lang === 'en' ? step.howItWorksEn : step.howItWorksHi).map((act, i) => (
                        <li key={i} className="flex items-start gap-2 leading-relaxed">
                          <ChevronRight size={13} className="text-green-600 shrink-0 mt-0.5 sm:w-3.5 sm:h-3.5" />
                          <span>{act}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Pro-Tips footer inside card */}
                  <div className="bg-amber-50/50 border border-amber-200/60 p-3 rounded-lg sm:rounded-xl flex items-start sm:items-center gap-2 text-[10px] sm:text-xs text-amber-900 font-medium leading-relaxed">
                    <Sparkles size={13} className="text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
                    <span>{lang === 'en' ? step.tipsEn : step.tipsHi}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Bottom Sticky Footer Bar */}
        <div className="p-3.5 sm:p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium text-center sm:text-left leading-tight">
            💡 {lang === 'en' ? "Quick Access: Click on any Route badge to visit that screen instantly." : "त्वरित उपयोग: सीधे उस स्क्रीन पर जाने के लिए ऊपर दिए गए Route बैज पर क्लिक करें।"}
          </p>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 sm:py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs transition-all cursor-pointer border-none shadow-sm active:scale-95"
          >
            {lang === 'en' ? "Got it, Thanks!" : "समझ आ गया, धन्यवाद!"}
          </button>
        </div>

      </div>
    </div>
  );
}
