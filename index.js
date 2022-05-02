require('dotenv').config();
const express = require('express');
const mailchimp = require('@mailchimp/mailchimp_marketing');
var Airtable = require('airtable');
const bodyParser = require('body-parser');
const res = require('express/lib/response');

//Initializing express application
const app = express();
app.use(bodyParser.json());

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
// const getReport = async () => {
//     const response = await mailchimp.campaigns.list({
//         'fields': ['campaigns.id', 'campaigns.status', 'campaigns.emails_sent', 'campaigns.report_summary.unique_opens'],
//     });

//     // console.log(response);
//     const records = [];

//     //Flatten the response object and modify format as required in airtable API
//     for (let campaign of response.campaigns) {

//         const currentCampaign = {};
//         currentCampaign["Campaign ID"] = campaign['id'];
//         currentCampaign['Status'] = campaign['status'];
//         currentCampaign["Emails sent"] = campaign['emails_sent'];
//         currentCampaign["Emails opened"] = campaign['report_summary'].unique_opens;

//         const temporaryObject = {};
//         temporaryObject['fields'] = currentCampaign;

//         records.push(temporaryObject);
//     }

//     //Airtable API call to push records to base
//     base(AIRTABLE_TABLE_NAME).create(
//         records,
//         function (err, records) {
//             if (err) {
//                 console.error(err);
//                 return;
//             }
//             return records;
//         }
//     );
// };


//Function to get campaign details from Mailchimp and populate it to Airtable
const getReport = async () => {

    //Get all campaign ids
    const campaignIds = await mailchimp.campaigns.list({
        'fields': ['campaigns.id'],
    });

    // const campaigns = [];

    //Perform operations for each Campaign in the list
    campaignIds.campaigns.forEach(async (campaignId) => {

        //Get detailed information for each campaign
        const response = await mailchimp.campaigns.get(
            campaignId.id,
            { 'fields': ['id', 'create_time', 'emails_sent', 'send_time', 'resendable', 'recipients.list_id', 'settings.subject_line', 'report_summary.unique_opens', 'status'] },
        );

        //Get emails of all recipients for the campaign
        const listMembers = await mailchimp.lists.getListMembersInfo(
            response.recipients.list_id,
            { 'fields': ['members.email_address', 'members.stats.avg_open_rate'] }
        );
        let recipients = listMembers.members.map((recipient) => recipient.email_address);
        recipients = recipients.join(',');
        // console.log(recipients);

        //Get list of recipients who have opened the campaign email
        let openedRecipients = await mailchimp.reports.getCampaignOpenDetails(
            campaignId.id,
            { 'fields': ['members.email_address'] }
        );
        let opened = openedRecipients.members.map((recipient) => recipient.email_address);
        opened = opened.join(',');

        // Final response example
        // {
        //     id: '892b713911',
        //     create_time: '2022-04-30T04:52:10+00:00',
        //     emails_sent: 1,
        //     send_time: '2022-04-30T05:26:37+00:00',
        //     resendable: false,
        //     recipients: { members: [[Object], [Object]] },
        //     settings: { subject_line: 'Mailchimp test' },
        //     report_summary: { opens: 0 }
        // }
        // console.log(response);

        response.recipients = listMembers;

        //
        const createTime = Date(response.create_time) ? new Date(response.create_time).toDateString() : '';
        const sendTime = response.send_time ? new Date(response.create_time).toDateString() : '';

        //Create and modify object as required by Airtable API 
        const records = [];

        const currentRecipientObject = {};
        // console.log(recipient);

        currentRecipientObject["Campaign ID"] = response.id;
        currentRecipientObject['Status'] = response['status'];
        currentRecipientObject["Emails sent"] = response['emails_sent'];
        currentRecipientObject["Emails opened"] = response['report_summary'] ? response['report_summary'].unique_opens : 0;
        currentRecipientObject["Email subject"] = response['settings'].subject_line || '';
        currentRecipientObject["Create time"] = createTime;
        currentRecipientObject["Send time"] = sendTime;
        currentRecipientObject["Recipients"] = recipients ? recipients : '';
        currentRecipientObject["Opened"] = opened ? opened : '';

        const temporaryObject = {};
        temporaryObject['fields'] = currentRecipientObject;

        records.push(temporaryObject);

        // Airtable API call to push records to base
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

    });
};

//ROUTES

// 1-Get reports
app.get('/getReport', async (req, res) => {
    try {
        await getReport();

        res.status(200).json({ message: 'Updating your records' });
    }
    catch (error) {
        console.log(error);
        res.status(503).json({ message: "An error occured" });
    }

});


// 2-Resend Emails to non-opener recipients of a campaign
app.post('/resendEmails', async (req, res) => {

    try {
        const { campaignId } = req.body;
        console.log(campaignId);

        // Create a resend version (creates new campaign id)
        const response = await mailchimp.campaigns.createResend(campaignId);

        if (response.status === save) {

            //Use new unique id here
            const result = await client.campaigns.send(response.id);
            console.log(result);

            res.status(200).json({ message: 'Successfully resent Emails to non-openers' });
        }
    }
    catch (error) {
        console.log(error);
        res.status(503).json({ message: 'Error processing your request' });
    }
});


//Send a campaign

app.post('/sendEmails', async (req,res) => {
    try{
        const {campaignId} = req.body;
    
        const newCampaignId = await mailchimp.campaigns.send(campaignId);
    
        res.status(200).json({'campaignId': newCampaignId})
    }
    catch(error){
        console.log(error);
        res.status(503).json({message: 'An error occured'})
    }
});

app.listen(PORT, () => console.log('Server listening on port: ' + PORT));