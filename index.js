import puppeteer from 'puppeteer';
import dotenv from 'dotenv';
import twilio from "twilio";

dotenv.config();

const URL = process.env.URL;
const PASSWORD = process.env.PASSWORD;
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
const outboundPhoneNumber = process.env.OUTBOUND_PHONE_NUMBER;

const twilioClient = twilio(accountSid, authToken);

async function makePhoneCall(message) {
    try {
      await twilioClient.calls.create({
        twiml: `<Response><Say>${message}</Say></Response>`,
        to: outboundPhoneNumber,
        from: twilioPhoneNumber
      });
      console.log('Phone call initiated');
    } catch (error) {
      console.error('Error making phone call:', error);
    }
  }

async function checkSuperPriority() {
  const browser = await puppeteer.launch({headless: false});
  const page = await browser.newPage();

  try {
    await page.goto(URL);
    await page.waitForSelector('#password');
    await page.type('#password', PASSWORD);
    await page.click('#submit');
    await page.waitForSelector('#serviceOption');

    const superPriorityOption = await page.evaluate(() => {
      const options = document.querySelectorAll('#serviceOption input[type="radio"]');
      for (let option of options) {
        if (option.nextElementSibling.textContent.toLowerCase().includes('super priority')) {
          return option.value;
        }
      }
      return null;
    });

    if (superPriorityOption) {
      await makePhoneCall('Super priority service is available.');
      console.log('Super priority service is available. Browser kept open.');
      return true;
    } else {
      console.log('Only normal service is available.');
      await browser.close();
      return false;
    }
  } catch (error) {
    console.error('Error during check:', error);
    await browser.close();
    return false;
  }
}

async function runPeriodicCheck() {
  let superPriorityFound = false;

  while (!superPriorityFound) {
    console.log('Checking for super priority service...');
    superPriorityFound = await checkSuperPriority();

    if (!superPriorityFound) {
      console.log('Waiting 30 minutes before next check...');
      await new Promise(resolve => setTimeout(resolve, 30 * 60 * 1000));
    }
  }

  console.log('Super priority service found.');
}

// Start the periodic check
runPeriodicCheck();