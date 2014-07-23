balanced-ach-crowdfund
======================

<pre>
npm install balanced-ach-crowdfund
</pre>

Balanced ACH Debit Client for Equity Crowdfunding

Inspired by @MedStartr, a healthcare crowdfunding platform, this project provides the backend for similar minded startups who want to inspire healthcare innovations through crowdfunding.

##Equity Crowdfunding

This project is general enough to use for any crowdfinding ideas, but specially, it targets equity crowdfunding, using the fantastic ACH debit facilities offered by Balanced.

If you're not familar with equity crowdfinding and specifically the JOBS Act, you can find more information [here](http://en.wikipedia.org/wiki/Jumpstart_Our_Business_Startups_Act)

Balanced Payments is an open company that provides payment processing services thru REST API.  More information on their ACH debit services can be found [here](https://www.balancedpayments.com/ach-debits)

##Why Redis?

I am using Redis as a backend for simplicity and fast processing.  You can get persistence using the AOF option.  Most of the time, after a campaign is concluded, you'd probably archive it somewhere else, and not keep it in your website.  Finally, Redis offers an easy way to aggregate stats using zsets.
