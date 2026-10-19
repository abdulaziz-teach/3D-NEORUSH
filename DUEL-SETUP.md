# Onlayn duel serverini ishga tushirish

1. Node.js 18 yoki undan yangisini o‘rnating.
2. Loyiha papkasida `npm install` va keyin `npm start` buyrug‘ini bajaring.
3. Server ishlayotganini `http://localhost:3000/health` manzilida tekshiring.
4. O‘yinda **DUEL** ni bosing va WebSocket manzilini kiriting:
   - Mahalliy sinov: `ws://localhost:3000/duel`
   - Hostingdan keyin: `wss://<server-domeni>/duel`
5. Birinchi o‘yinchi xona ochadi; ikkinchisi shu server manzilini va ko‘rsatilgan 6 belgili kodni ishlatib kiradi.

Hosting serverida `PORT` muhit o‘zgaruvchisi portni tanlaydi. HTTPS sayt bilan ishlatganda serverni `wss://` orqali TLS ortida joylashtiring. Ixtiyoriy `ALLOWED_ORIGIN` muhit o‘zgaruvchisi WebSocket ulanishini bitta brauzer originiga cheklaydi.

Har duel serverda boshqariladigan bir xil uch yo‘lakli maydonda o‘tadi. Har o‘yinchida 3 jon bor; birinchi bo‘lib raqibining jonini tugatgan o‘yinchi g‘olib bo‘ladi va mijozida bir marta 250 tanga oladi. Tanga o‘yinchining brauzeridagi mahalliy saqlashga yoziladi; server tomonida hisob yoki doimiy profil saqlanmaydi.
