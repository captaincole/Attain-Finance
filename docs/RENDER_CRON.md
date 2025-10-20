# Cron Jobs

You can create [cron jobs](https://en.wikipedia.org/wiki/Cron) on Render that run periodically on a schedule you define. You create cron jobs in the [Render Dashboard](https://dashboard.render.com), just like you create any other service type:



<img src="#" alt="Creating a cron job in the Render Dashboard" />



Your cron job can use any of your [GitHub](/docs/github)/[GitLab](/docs/gitlab)/[Bitbucket](/docs/bitbucket) repos, or it can pull a [prebuilt Docker image](/docs/deploying-an-image) from an external registry.

- **If you connect a Git repo,** Render builds a new version of your code whenever you push changes to your connected branch. That built version is used for all later runs, until you push additional changes.
- **If you pull a Docker image,** Render pulls that image before _each run_ of your cron job. Render does not retain pulled images between runs.

<info-block>

Cron jobs can't provision or access a [persistent disk](/docs/disks#disk-limitations-and-considerations).

</info-block>

## Setup

The cron job setup flow is similar to that of any other Render service. However, the following fields are specific to cron jobs:



<img src="#" alt="Cron-job-specific settings in the Render Dashboard" />



<table class="apiref">
  <thead>
    <tr>
      <th>Field</th>
      <th>Description</th>
    </tr>
  </thead>
  <tbody>
<tr>
<td>

**Schedule**

</td>

<td>

The schedule to use for the cron job, defined as a [cron expression](https://en.wikipedia.org/wiki/Cron#CRON_expression).

Here are some examples:

- **Every ten minutes:** `*/10 * * * *`
- **Once every day at noon UTC:** `0 12 * * *`
- **Once every 60 minutes, Monday through Friday UTC:** `*/60 * * * MON-FRI`

Note that all day and time ranges use UTC.

</td>
</tr>
<tr>
<td>

**Command**

</td>
<td>

The command to execute with each run. This can be:

- Any valid Linux command, such as `echo "Hello!"`
- An executable [bash script](https://tldp.org/LDP/Bash-Beginners-Guide/html/sect_02_01.html) that contains the command(s) to run

**Make sure your command exits when the cron job finishes!** Cron jobs are billed according to how long they run.

</td>
</tr>
  </tbody>
</table>

### Environment variables

Like any other Render service, cron jobs can set [environment variables](/docs/configure-environment-variables) for values like database URLs and API keys. You can also share environment variables across multiple services with an [environment group](/docs/configure-environment-variables#environment-groups).

## Manually triggering a run

To run your cron job at an unscheduled time (such as for debugging purposes), go to its page in the [Render Dashboard](https://dashboard.render.com) and click **Trigger Run**.

<info-block>

If you manually trigger a cron job run while _another_ run is active, Render first _cancels_ the active run. For details, see [Single-run guarantee](#single-run-guarantee).

</info-block>

## Single-run guarantee

**Render guarantees that at most one run of a given cron job is active at a given time.** This protects against issues that can arise with parallel execution.

<faq-entry question="What if I manually trigger a run while another run is active?">

Render immediately cancels the active run, then starts the manually triggered run.

</faq-entry>

<faq-entry question="What if a run is currently active at the time of the next scheduled run?">

Render _delays_ the next scheduled run until the active run finishes.

</faq-entry>

<faq-entry question="What if my run never finishes or takes a very long time?">

Render stops an active run after 12 hours. To perform tasks that run longer than this (or continuously), instead create a [background worker](/docs/background-workers).

</faq-entry>

## Instance types and billing

Cron jobs can use whichever [instance type](/docs/pricing#cron-jobs) best suits their CPU and memory requirements. Billing is prorated by the second, based on active running time during a given month.

There is a minimum monthly charge of $1 per cron job service.