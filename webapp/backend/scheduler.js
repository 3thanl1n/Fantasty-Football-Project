const cron = require('node-cron');
const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:5000';

async function generatePolls() {
  try {
    const response = await axios.post(`${API_URL}/api/votes/generate-daily`, {}, {
      timeout: 30000
    });
    console.log('Poll generation successful:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error generating daily polls:', error.message);
    return null;
  }
}

async function checkAndGeneratePolls() {
  try {
    // Check if there are any active polls
    const response = await axios.get(`${API_URL}/api/votes/polls`, {
      timeout: 10000
    });
    
    const activePolls = response.data?.data || [];
    
    if (activePolls.length === 0) {
      console.log('No active polls found - generating new polls...');
      await generatePolls();
    } else {
      console.log(`Found ${activePolls.length} active poll(s) - skipping generation`);
    }
  } catch (error) {
    console.error('Error checking polls:', error.message);
    // If we can't check, try to generate anyway
    console.log('Attempting to generate polls anyway...');
    await generatePolls();
  }
}

function startScheduler() {
  // Run daily at 11:00 AM EST
  cron.schedule('0 11 * * *', async () => {
    console.log('Running daily poll generation at 11:00 AM EST...');
    await generatePolls();
  }, {
    timezone: 'America/New_York'
  });
  
  console.log('Daily poll scheduler initialized - polls will refresh at 11:00 AM EST');
  
  // Check and generate polls on startup (with a small delay to ensure server is ready)
  setTimeout(async () => {
    console.log('Checking for existing polls on startup...');
    await checkAndGeneratePolls();
  }, 2000);
}

module.exports = { startScheduler };

