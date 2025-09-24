// src/vantiBot.js
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

// Aplicamos el plugin stealth que se encarga de todo
puppeteer.use(StealthPlugin());

const VANTI_URL = "https://pagosenlinea.grupovanti.com/";
const SELECTOR_VALOR = "label.form.form-control.disabled";
const SELECTOR_POPUP = "#swal2-html-container";

const DEFAULT_OPTS = {
  headless: "new",
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--no-zygote",
    // --- EL ARGUMENTO MÁS IMPORTANTE PARA EVADIR DETECCIÓN ---
    "--disable-blink-features=AutomationControlled",
  ],
  defaultViewport: { width: 1280, height: 900 }
};

function nowISO() {
  return new Date().toISOString();
}

function parseMontoCOP(txt) {
  if (!txt) return null;
  const raw = txt.replace(/[^\d,.,-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

async function extractValorAPagar(page) {
  // 1) Intento por selector directo
  const direct = await page.$$eval(SELECTOR_VALOR, nodes => {
    for (const n of nodes) {
      const t = (n.textContent || "").trim();
      if (t.startsWith("$")) return t;
    }
    return null;
  }).catch(() => null);
  if (direct) return direct;

  // 2) Fallback por texto cercano
  const probe = await page.evaluate(() => {
    function text(el){ return (el.textContent||"").trim(); }
    const candidates = Array.from(document.querySelectorAll("label, span, div, p, strong, b"));
    for (const c of candidates) {
      const t = text(c).toLowerCase();
      if (/(valor|total|pagar)/.test(t)) {
        const around = [
          ...Array.from(c.parentElement?.querySelectorAll("*") || []),
          ...Array.from(c.closest("article,section,div")?.querySelectorAll("*") || [])
        ];
        for (const a of around) {
          const s = text(a);
          if (/^\$\s?\d/.test(s)) return s;
        }
      }
    }
    const anyMoney = candidates.map(text).find(tx => /^\$\s?\d/.test(tx));
    return anyMoney || null;
  });
  if (probe) return probe;

  return null;
}

function interpretPopupText(txtRaw){
  const t = (txtRaw || "").toUpperCase();
  if (t.includes("YA PAGADA")) return { status: "PAID", message: "REFERENCIA YA PAGADA" };
  if (t.includes("NO ENCONTRADA")) return { status: "NOT_FOUND", message: "REFERENCIA NO ENCONTRADA" };
  return { status: "UNKNOWN", message: txtRaw?.trim() || "Mensaje desconocido" };
}

function wait(ms){ return new Promise(r => setTimeout(r, ms)); }

export async function consultarVanti(numeroDeCuenta, {
  retries = 3,
  timeoutMs = 30000,
  launchOptions = DEFAULT_OPTS
} = {}) {
  if (!numeroDeCuenta) throw new Error("Falta numeroDeCuenta");

  let lastErr = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    let browser;
    try {
      browser = await puppeteer.launch(launchOptions);
      const page = await browser.newPage();
      page.setDefaultTimeout(timeoutMs);

      await page.goto(VANTI_URL, { waitUntil: "networkidle2", timeout: timeoutMs });

      await page.waitForSelector("#empresa", { visible: true });
      await page.select("#empresa", "79");

      await page.waitForSelector("#cuenta_contrato", { visible: true });
      await page.type("#cuenta_contrato", numeroDeCuenta, { delay: 10 }); // Pequeño delay humano

      if (await page.$("#image1")) {
        await page.click("#image1");
      }

      await page.waitForFunction(
        '(() => { const b = document.querySelector(".btn.btn-primary.query-button"); return b && !b.disabled; })()',
        { timeout: 15000 }
      );
      await page.click(".btn.btn-primary.query-button");

      const winner = await Promise.race([
        page.waitForSelector(SELECTOR_VALOR, { visible: true, timeout: 20000 }).then(() => "VALOR"),
        page.waitForSelector(SELECTOR_POPUP, { visible: true, timeout: 20000 }).then(() => "POPUP")
      ]).catch(() => null);

      if (!winner) throw new Error("Tiempo de espera agotado sin resultado");

      if (winner === "POPUP") {
        const popupText = await page.$eval(SELECTOR_POPUP, el => (el.textContent || "").trim()).catch(() => "");
        const info = interpretPopupText(popupText);
        await browser.close();
        return {
          ok: info.status === "UNKNOWN" ? false : true,
          status: info.status,
          account: numeroDeCuenta,
          message: info.message,
          fetched_at: nowISO(),
          attempt
        };
      }

      const amountText = await extractValorAPagar(page);
      if (!amountText) throw new Error("No se encontró el valor a pagar.");
      await browser.close();
      return {
        ok: true,
        status: "DUE",
        account: numeroDeCuenta,
        amount_text: amountText.trim(),
        currency: "COP",
        parsed_amount: parseMontoCOP(amountText),
        fetched_at: nowISO(),
        attempt
      };
    } catch (e) {
      lastErr = e;
      if (browser) try { await browser.close(); } catch {}
      if (attempt < retries) await wait(1000 * attempt);
    }
  }

  return {
    ok: false,
    status: "ERROR",
    account: numeroDeCuenta,
    error: (lastErr && lastErr.message) || "Error desconocido",
    fetched_at: nowISO()
  };
}
