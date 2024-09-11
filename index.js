import puppeteer from 'puppeteer';
import dotenv from 'dotenv';
import twilio from "twilio";

// Load environment variables
dotenv.config();

// Environment variables
const URL = process.env.URL;
const PASSWORD = process.env.PASSWORD;
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
const outboundPhoneNumber = process.env.OUTBOUND_PHONE_NUMBER;

// Initialize Twilio client
const twilioClient = twilio(accountSid, authToken);

// Make a phone call using Twilio to remind the appointment is available
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

// Handle login and navigation
async function loginAndNavigate(page) {
  await page.goto(URL);
  await page.waitForSelector('#password');
  await page.type('#password', PASSWORD);
  await page.click('#submit');
  await page.waitForSelector('#serviceOption');
}

// Check for super priority service
async function checkSuperPriority() {
  // Launch browser in headless mode
  const browser = await puppeteer.launch({headless: 'new'});
  const page = await browser.newPage();

  try {
    await loginAndNavigate(page);

    // Check for super priority DOM element
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
      // Super priority found, make call and switch to non-headless mode
      await makePhoneCall('Super priority service is available.');
      console.log('Super priority service is available. Reopening in non-headless mode...');
      await browser.close();
      
      // Relaunch in non-headless mode for manual interaction
      const manualBrowser = await puppeteer.launch({headless: false});
      const manualPage = await manualBrowser.newPage();
      await loginAndNavigate(manualPage);
      // Browser left open for manual interaction
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

// Run this script every 1 minute
async function runPeriodicCheck() {
  let superPriorityFound = false;

  while (!superPriorityFound) {
    console.log('Checking for super priority service...');
    superPriorityFound = await checkSuperPriority();

    if (!superPriorityFound) {
      console.log('Waiting a minute before next check...');
      // Wait for 1 minute before next check
      await new Promise(resolve => setTimeout(resolve, 1 * 60 * 1000));
    }
  }

  console.log('Super priority service found.');
}

// Start the periodic check
runPeriodicCheck();