require('dotenv').config();
const express = require('exoress');
const mailchimp = require('@mailchimp/mailchimp_marketing');
var Airtable = require('airtable');
const { forEach } = require('lodash');
const _ = require('lodash');

//Initializing express application
const app = express();

//Get port from environment variable
const PORT = process.env.PORT || 4000;

//Mailchimp API environment variables
const MAILCHIMP_API_KEY = process.env.MAILCHIMP_API_KEY;
const SERVER_PREFIX = process.env.SERVER_PREFIX;

//Airtable API environment variables
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

//Mailchimp API configuration
mailchimp.setConfig({
    apiKey: MAILCHIMP_API_KEY,
    server: SERVER_PREFIX,
});

//Selecting Airtable base
var base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);


//Function to get campaign details from Mailchimp and populate it to Airtable
const getReport = async () => {
    const response = await mailchimp.campaigns.list({
        'fields': ['campaigns.id', 'campaigns.status', 'campaigns.emails_sent', 'campaigns.report_summary.unique_opens'],
    });

    // console.log(response);
    const records = [];

    //Flatten the response object and modify format as required in airtable API
    for (let campaign of response.campaigns) {

        const currentCampaign = {};
        currentCampaign["Campaign ID"] = campaign['id'];
        currentCampaign['Status'] = campaign['status'];
        currentCampaign["Emails sent"] = campaign['emails_sent'];
        currentCampaign["Emails opened"] = campaign['report_summary'].unique_opens;
        
        const temporaryObject = {};
        temporaryObject['fields'] = currentCampaign;

        records.push(temporaryObject);
    }

    //Airtable API call to push records to base
    base(AIRTABLE_TABLE_NAME).create(
        records,
        function (err, records) {
            if (err) {
                console.error(err);
                return;
            }
            return records;
        }
    );
};

//ROUTES

// 1-Get reports
app.get('/getReport', async (req,res) => {
    const records = await getReport();

    res.status(200).send(records);
});


app.listen(PORT, () => console.log('Server listening on port' + PORT));