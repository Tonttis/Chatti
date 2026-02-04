# 💬 Reaaliaikainen chat-sovellus

Moderni **full-stack reaaliaikainen chat-sovellus**, jossa viestit ja chat-huoneet tallennetaan pysyvästi **SQLite-tietokantaan**. Sovellus toimii ilman rekisteröitymistä ja tukee useita huoneita reaaliaikaisella viestinnällä. ⚡

---

## ✨ Ominaisuudet

- 🔄 **Reaaliaikainen viestintä** Socket.io:n avulla  
- 🏠 **Useita chat-huoneita** viestihistorian kanssa  
- 💾 **Pysyvä tallennus** – SQLite tallentaa kaikki viestit ja huoneet  
- 👤 **Anonyymi käyttö** – ei kirjautumista tai rekisteröitymistä  
- ➕ **Huoneiden luonti** käyttäjien toimesta  
- ✍️ **Kirjoitusilmaisimet** – näe, milloin muut kirjoittavat  
- 🟢 **Käyttäjien läsnäolo** huonekohtaisesti  
- 📱 **Responsiivinen käyttöliittymä** Tailwind CSS:n avulla  

---

## 🛠️ Teknologiat

### 🎨 Frontend
- ⚛️ React 19 + TypeScript  
- ⚡ Vite  
- 🎨 Tailwind CSS 3.4  
- 🧩 shadcn/ui  
- 🔌 Socket.io-client  
- 🖼️ Lucide React  

### ⚙️ Backend
- 🟢 Node.js + Express  
- 🔌 Socket.io  
- 🗄️ SQLite (better-sqlite3)  
- 🆔 UUID  

## 🚀 Asennus

### 📦 Vaatimukset
- Node.js **20+** **tai** Bun  
- npm tai bun  

---

## Kehitys (Bun)

```bash
npm install -g bun
bun install
bun run dev

```

## Tuotanto (Bun)
```bash
bun run build
bun run start

```
## Käyttö

http://localhost:3000
