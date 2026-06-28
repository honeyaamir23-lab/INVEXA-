import { Item } from "../types";

export function getLocalFallbackResponse(userMessage: string, inventory: Item[]): string {
  const text = userMessage.toLowerCase();
  
  // Detect language
  const isUrduScript = /[\u0600-\u06FF]/.test(userMessage);
  const isRomanUrdu = /\b(karo|kia|batao|hai|mujhe|dikhao|kam|sab|chal|dekh|ko|se|bhai|sir|stock|mushwara)\b/i.test(userMessage);
  
  // Calculate inventory metrics
  const totalItems = inventory.length;
  let totalQty = 0;
  let totalValuation = 0;
  let totalCostValuation = 0;
  let lowStockCount = 0;
  const lowStockItems: Item[] = [];
  
  for (const item of inventory) {
    // Check both variations of properties to be absolutely safe
    const qty = Number(item.qty !== undefined ? item.qty : (item as any).quantity) || 0;
    const price = Number(item.price !== undefined ? item.price : (item as any).sellingPrice) || 0;
    const cost = Number(item.costPrice !== undefined ? item.costPrice : 0) || 0;
    
    totalQty += qty;
    totalValuation += qty * price;
    totalCostValuation += qty * cost;
    
    if (qty <= 5) {
      lowStockCount++;
      lowStockItems.push(item);
    }
  }
  
  const grossProfit = totalValuation - totalCostValuation;
  const profitMarginPercent = totalValuation > 0 ? (grossProfit / totalValuation) * 100 : 0;

  // Let's check for specific product search in user message
  let queriedItem: Item | null = null;
  for (const item of inventory) {
    const name = (item.name || "").toLowerCase();
    const cat = (item.category || "").toLowerCase();
    if (text.includes(name) || (name.length > 3 && text.includes(name.substring(0, name.length - 1)))) {
      queriedItem = item;
      break;
    }
  }

  // Urdu Script Fallback Response
  if (isUrduScript) {
    // 1. Specific product search for "roll" or "رول"
    if (text.includes("رول") || text.includes("roll")) {
      const rollItem = inventory.find(i => (i.name || "").toLowerCase().includes("roll") || (i.name || "").includes("رول"));
      if (!rollItem) {
        return `**WALEED FOODS انوینٹری رپورٹ:**\n\nہمارے پاس انوینٹری میں **رول (Roll)** کا اسٹاک موجود نہیں ہے۔ اگر آپ اسے ایڈ کرنا چاہتے ہیں تو براہ کرم انوینٹری پیج پر جا کر نیا آئٹم شامل کریں۔`;
      } else {
        const q = Number(rollItem.qty !== undefined ? rollItem.qty : (rollItem as any).quantity) || 0;
        const p = Number(rollItem.price !== undefined ? rollItem.price : (rollItem as any).sellingPrice) || 0;
        const c = Number(rollItem.costPrice !== undefined ? rollItem.costPrice : 0) || 0;
        return `**WALEED FOODS رپورٹ (رول):**\n\n* **آئٹم کا نام:** ${rollItem.name}\n* **موجودہ اسٹاک:** ${q} units\n* **خریداری قیمت:** Rs. ${c}\n* **فروخت قیمت:** Rs. ${p}\n* **اسٹاک مالیت:** Rs. ${q * p}`;
      }
    }

    if (queriedItem) {
      const q = Number(queriedItem.qty !== undefined ? queriedItem.qty : (queriedItem as any).quantity) || 0;
      const p = Number(queriedItem.price !== undefined ? queriedItem.price : (queriedItem as any).sellingPrice) || 0;
      const c = Number(queriedItem.costPrice !== undefined ? queriedItem.costPrice : 0) || 0;
      const itemVal = q * p;
      return `**آئٹم کی معلومات (${queriedItem.name}):**\n\n* **کیٹیگری:** ${queriedItem.category || "General"}\n* **موجودہ اسٹاک:** **${q}** یونٹس\n* **خریداری قیمت (Cost Price):** Rs. ${c}\n* **فروخت قیمت (Selling Price):** Rs. ${p}\n* **کل اسٹاک مالیت:** Rs. ${itemVal}\n* **منافع مارجن:** ${p > 0 ? (((p - c) / p) * 100).toFixed(1) : "0"}%\n\nاگر قیمتیں 0 ہیں تو براہ کرم انوینٹری پیج پر جا کر قیمتیں درست کریں۔`;
    }

    // 2. Valuation and Margin query
    if (text.includes("valuation") || text.includes("profit") || text.includes("margin") || text.includes("مالیت") || text.includes("منافع") || text.includes("کل")) {
      return `**WALEED FOODS انوینٹری مالیاتی رپورٹ:**\n\n* **کل رجسٹرڈ آئٹمز:** **${totalItems}**\n* **موجودہ کل اسٹاک مالیت (Valuation):** **Rs. ${totalValuation.toLocaleString()}**\n* **مجموعی خریداری لاگت (Cost Valuation):** **Rs. ${totalCostValuation.toLocaleString()}**\n* **متوقع منافع (Estimated Profit):** **Rs. ${grossProfit.toLocaleString()}**\n* **اوسط منافع مارجن (Avg Margin):** **${profitMarginPercent.toFixed(1)}%**\n\n*نوٹ: اگر کسی آئٹم کی لاگت یا قیمتِ فروخت 0 ہے تو مارجنز درست کرنے کے لیے انوینٹری پیج پر اپڈیٹ کریں۔*`;
    }

    // 3. Low stock / Reorder query
    if (text.includes("low") || text.includes("stock") || text.includes("کم") || text.includes("سٹاک") || text.includes("رپورٹ")) {
      if (lowStockCount === 0) {
        return `**سٹاک الرٹ:**\n\nآپ کی انوینٹری میں تمام آئٹمز کا اسٹاک بہترین ہے۔ کوئی بھی آئٹم شارٹ یا کم اسٹاک (<= 5) میں نہیں ہے۔`;
      }
      const lowList = lowStockItems.map(i => {
        const q = Number(i.qty !== undefined ? i.qty : (i as any).quantity) || 0;
        return `* **${i.name}**: موجودہ اسٹاک ${q} (کیٹیگری: ${i.category || "General"})`;
      }).join("\n");
      return `**کم اسٹاک والے آئٹمز کی لسٹ (Low Stock Alert):**\n\n${lowList}\n\n**مشورہ:** ان آئٹمز کو فوری طور پر دوبارہ آرڈر کرنے کا بندوبست کریں تاکہ سپلائی چین متاثر نہ ہو۔`;
    }

    // 4. Business Advice
    if (text.includes("advice") || text.includes("growth") || text.includes("مشورہ") || text.includes("رہنمائی")) {
      return `**WALEED FOODS بزنس ایڈوائس رپورٹ:**\n\n1. **منافع بڑھانے کے لیے:** آپ کا اوسط منافع مارجن **${profitMarginPercent.toFixed(1)}%** ہے۔ کم مارجن والے آئٹمز کی قیمتوں کا ازسرنو جائزہ لیں۔\n2. **سٹاک مینجمنٹ:** انوینٹری میں **${totalItems}** آئٹمز موجود ہیں جن کی کل مالیت **Rs. ${totalValuation.toLocaleString()}** ہے۔ ان آئٹمز کا اسٹاک کم رکھیں جن کی فروخت دھیمی ہے۔\n3. **کم اسٹاک الرٹس:** فی الحال **${lowStockCount}** آئٹمز کا اسٹاک کم ہے۔ ان کا آرڈر فوری دیں تاکہ کسٹمرز واپس نہ جائیں۔`;
    }

    // Default Greeting / Generic response in Urdu script
    return `**السلام علیکم!** میں آپ کا **INVEXA اسمارٹ اسسٹنٹ** ہوں۔\n\nمیں نے آپ کی انوینٹری کا ریل ٹائم ڈیٹا کامیابی سے لوڈ کر لیا ہے۔ آپ مجھ سے درج ذیل سوالات پوچھ سکتے ہیں:\n\n* **کل اسٹاک کی مالیت اور منافع مارجن کتنا ہے؟**\n* **کون سے آئٹمز کا اسٹاک کم ہے؟**\n* **کسی مخصوص آئٹم (جیسے میدہ، گھی، رول) کا اسٹاک چیک کریں۔**\n* **کاروبار بڑھانے کا مفید مشورہ لیں۔**`;
  }

  // Roman Urdu Fallback Response
  if (isRomanUrdu) {
    if (text.includes("رول") || text.includes("roll")) {
      const rollItem = inventory.find(i => (i.name || "").toLowerCase().includes("roll") || (i.name || "").includes("رول"));
      if (!rollItem) {
        return `**WALEED FOODS Inventory Report:**\n\nHamaray paas inventory mein **Roll (رول)** ka stock majood nahi hai. Agar aap isko add karna chahtay hain to inventory page par ja kar naya item add karein.`;
      } else {
        const q = Number(rollItem.qty !== undefined ? rollItem.qty : (rollItem as any).quantity) || 0;
        const p = Number(rollItem.price !== undefined ? rollItem.price : (rollItem as any).sellingPrice) || 0;
        const c = Number(rollItem.costPrice !== undefined ? rollItem.costPrice : 0) || 0;
        return `**WALEED FOODS Report (Roll):**\n\n* **Item Name:** ${rollItem.name}\n* **Majooda Stock:** ${q} units\n* **Kharidari Price:** Rs. ${c}\n* **Sale Price:** Rs. ${p}\n* **Stock Value:** Rs. ${q * p}`;
      }
    }

    if (queriedItem) {
      const q = Number(queriedItem.qty !== undefined ? queriedItem.qty : (queriedItem as any).quantity) || 0;
      const p = Number(queriedItem.price !== undefined ? queriedItem.price : (queriedItem as any).sellingPrice) || 0;
      const c = Number(queriedItem.costPrice !== undefined ? queriedItem.costPrice : 0) || 0;
      const itemVal = q * p;
      return `**Item Info (${queriedItem.name}):**\n\n* **Category:** ${queriedItem.category || "General"}\n* **Stock:** **${q}** units\n* **Kharidari Cost:** Rs. ${c}\n* **Sale Price:** Rs. ${p}\n* **Stock Value:** Rs. ${itemVal}\n* **Profit Margin:** ${p > 0 ? (((p - c) / p) * 100).toFixed(1) : "0"}%\n\nAgar price zero hai toh inventory page par ja kar cost aur selling price set karein.`;
    }

    if (text.includes("valuation") || text.includes("profit") || text.includes("margin") || text.includes("paisa") || text.includes("faida") || text.includes("hisaab") || text.includes("summary")) {
      return `**WALEED FOODS Inventory Financial Report (Roman Urdu):**\n\n* **Total Items:** **${totalItems}**\n* **Total Stock Valuation:** **Rs. ${totalValuation.toLocaleString()}**\n* **Total Cost Valuation:** **Rs. ${totalCostValuation.toLocaleString()}**\n* **Expected Profit (Est. Profit):** **Rs. ${grossProfit.toLocaleString()}**\n* **Avg Profit Margin:** **${profitMarginPercent.toFixed(1)}%**\n\n*Note: Agar kisi item ki cost price ya selling price 0 hai, toh accurate calculations ke liye inventory page par use update karein.*`;
    }

    if (text.includes("low") || text.includes("stock") || text.includes("kam") || text.includes("short")) {
      if (lowStockCount === 0) {
        return `**Stock Alert:**\n\nSaray items ka stock bilkul theek hai! Koi bhi item kam stock (<= 5) mein nahi hai.`;
      }
      const lowList = lowStockItems.map(i => {
        const q = Number(i.qty !== undefined ? i.qty : (i as any).quantity) || 0;
        return `* **${i.name}**: Stock ${q} (Category: ${i.category || "General"})`;
      }).join("\n");
      return `**Kam Stock Walay Items Ki List:**\n\n${lowList}\n\n**Mashwara:** In items ka jaldi order dein taake supply chain mein rukawat na aaye.`;
    }

    if (text.includes("advice") || text.includes("growth") || text.includes("mashwara") || text.includes("tarika")) {
      return `**WALEED FOODS Business Advice (Roman Urdu):**\n\n1. **Profit Barhanay ke liye:** Aapka average profit margin **${profitMarginPercent.toFixed(1)}%** hai. Kam margin walay items ki prices barhane par ghaur karein.\n2. **Stock Valuation:** Aapka kul **Rs. ${totalValuation.toLocaleString()}** ka maal inventory mein majood hai. Slow-moving items ko sale par lagayein.\n3. **Reorder Alerts:** Abhi **${lowStockCount}** items ka stock short hai. Inka order jaldi karein taake customer khali hath na jaye.`;
    }

    return `**Assalam-o-Alaikum!** Main aapka **INVEXA Financial Agent** hoon.\n\nMene aapki store inventory ka live database loading complete kar liya hai. Aap mujhse ye sawal pooch sakte hain:\n\n* **Total valuation aur profit margin kitna hai?**\n* **Konsay products ka stock short chal raha hai?**\n* **Kisi khas product ka stock check karein.**\n* **Business grow karne ka mashwara lein.**`;
  }

  // English Fallback Response
  if (text.includes("roll") || text.includes("رول")) {
    const rollItem = inventory.find(i => (i.name || "").toLowerCase().includes("roll") || (i.name || "").includes("رول"));
    if (!rollItem) {
      return `**WALEED FOODS Inventory Report:**\n\nWe do not currently have **Roll** stock in your active database. To add it, please go to the Inventory management page.`;
    } else {
      const q = Number(rollItem.qty !== undefined ? rollItem.qty : (rollItem as any).quantity) || 0;
      const p = Number(rollItem.price !== undefined ? rollItem.price : (rollItem as any).sellingPrice) || 0;
      const c = Number(rollItem.costPrice !== undefined ? rollItem.costPrice : 0) || 0;
      return `**WALEED FOODS Stock Report (Roll):**\n\n* **Item Name:** ${rollItem.name}\n* **Stock Level:** ${q} units\n* **Purchase Cost:** Rs. ${c}\n* **Selling Price:** Rs. ${p}\n* **Current Valuation:** Rs. ${q * p}`;
    }
  }

  if (queriedItem) {
    const q = Number(queriedItem.qty !== undefined ? queriedItem.qty : (queriedItem as any).quantity) || 0;
    const p = Number(queriedItem.price !== undefined ? queriedItem.price : (queriedItem as any).sellingPrice) || 0;
    const c = Number(queriedItem.costPrice !== undefined ? queriedItem.costPrice : 0) || 0;
    const itemVal = q * p;
    return `**Item Details (${queriedItem.name}):**\n\n* **Category:** ${queriedItem.category || "General"}\n* **Current Stock:** **${q}** units\n* **Cost Price:** Rs. ${c}\n* **Selling Price:** Rs. ${p}\n* **Stock Valuation:** Rs. ${itemVal}\n* **Profit Margin:** ${p > 0 ? (((p - c) / p) * 100).toFixed(1) : "0"}%`;
  }

  if (text.includes("valuation") || text.includes("profit") || text.includes("margin") || text.includes("calculation") || text.includes("total") || text.includes("summary")) {
    return `**WALEED FOODS Live Inventory Financial Report:**\n\n* **Total Registered Products:** **${totalItems}**\n* **Total Inventory Value:** **Rs. ${totalValuation.toLocaleString()}**\n* **Total Cost Valuation:** **Rs. ${totalCostValuation.toLocaleString()}**\n* **Estimated Profit Margin:** **Rs. ${grossProfit.toLocaleString()} (${profitMarginPercent.toFixed(1)}%)**\n\n*Tip: If any items have 0 for prices, visit the Inventory page to add prices so profit metrics recalculate accurately.*`;
  }

  if (text.includes("low") || text.includes("stock") || text.includes("short") || text.includes("reorder")) {
    if (lowStockCount === 0) {
      return `**Reorder & Stock Report:**\n\nExcellent! All items have strong stock levels. No items are currently running low (<= 5).`;
    }
    const lowList = lowStockItems.map(i => {
      const q = Number(i.qty !== undefined ? i.qty : (i as any).quantity) || 0;
      return `* **${i.name}**: Stock ${q} units (Category: ${i.category || "General"})`;
    }).join("\n");
    return `**Low Stock Alert (Stock <= 5 units):**\n\n${lowList}\n\n**Action Item:** Place a reorder soon to avoid running out of stock.`;
  }

  if (text.includes("advice") || text.includes("growth") || text.includes("insight")) {
    return `**INVEXA Financial Insights & Business Strategy:**\n\n1. **Maximize Margin:** Your average store profit margin is **${profitMarginPercent.toFixed(1)}%**. Consider increasing selling prices on items below 10% margin.\n2. **Dead Stock Reduction:** You have a total inventory valuation of **Rs. ${totalValuation.toLocaleString()}**. Liquidate slow-moving categories through combo sales.\n3. **Proactive Reorder:** There are **${lowStockCount}** items that are dangerously low in stock. Ordering early avoids customer turn-away.`;
  }

  return `**Welcome!** I am your **INVEXA Enterprise Financial Agent**.\n\nI have successfully synced your live store database records. You can ask me:\n\n* **What is the total valuation & profit margin?**\n* **Which products are low in stock?**\n* **Get business advice or check specific items.**`;
}
