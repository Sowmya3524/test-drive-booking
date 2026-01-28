# How to Run the Project - Terminal Commands

## Option 1: Open Directly in Browser (Simplest)
Since you're using Supabase directly, you can just open the HTML file:

1. Navigate to the project folder in File Explorer
2. Double-click `index.html`
   OR
3. Right-click `index.html` → Open with → Your browser (Chrome/Edge/Firefox)

**Note:** Make sure your Supabase API keys are configured in `script.js`

---

## Option 2: Using Node.js Server (Recommended)

### Step 1: Open PowerShell/Terminal
- Press `Win + X` → Select "Windows PowerShell" or "Terminal"
- OR Right-click the project folder → "Open in Terminal"

### Step 2: Navigate to Project Folder
```powershell
cd "C:\Raam Groups - Intern\Home test drives"
```

### Step 3: Install Dependencies (First time only)
```powershell
npm install
```

**If you get "npm is not recognized":**
- Install Node.js from: https://nodejs.org/
- Restart PowerShell after installation
- Try `npm install` again

### Step 4: Start the Server
```powershell
npm start
```

**OR directly:**
```powershell
node server.js
```

### Step 5: Open in Browser
- The server will show: `Server running at http://localhost:3000`
- Open your browser and go to: **http://localhost:3000/index.html**

### Step 6: Stop the Server
- Press `Ctrl + C` in the terminal to stop the server

---

## Quick Reference Commands

```powershell
# Navigate to folder
cd "C:\Raam Groups - Intern\Home test drives"

# Install dependencies (first time)
npm install

# Start server
npm start

# OR
node server.js

# Stop server
Ctrl + C
```

---

## Troubleshooting

### "npm is not recognized"
- Install Node.js: https://nodejs.org/
- Restart PowerShell
- Verify: `node --version` and `npm --version`

### "Port 3000 already in use"
- Change port in `server.js`: `const PORT = 3001;`
- OR close the program using port 3000

### "Cannot find module"
- Run `npm install` again
- Check that `node_modules` folder exists

---

## Which Option Should I Use?

- **Option 1 (Direct HTML)**: Fastest, works if Supabase is configured
- **Option 2 (Node Server)**: Better for development, serves files properly, avoids CORS issues
