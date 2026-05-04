# Sync built site + data to S3 and optionally invalidate CloudFront.
# Prerequisites: aws cli, npm run build, optional npm run fetch:sheet
#
# CloudFront: automated CloudFormation in this repo hit AWS::EarlyValidation::PropertyValidation
# (account/org policy). Create a distribution in the AWS Console: origin = S3 REST endpoint
# strength-training-tracker.s3.ca-central-1.amazonaws.com, Origin access = OAC, default root
# object index.html, custom error 403/404 -> /index.html (200). Then attach a bucket policy allowing
# s3:GetObject for arn:aws:s3:::strength-training-tracker/* with Condition StringEquals
# AWS:SourceArn = arn:aws:cloudfront::<account-id>:distribution/<distribution-id>.
#
# Sheet refresh Lambda: npm run build:lambda, zip lambda/dist/index.js at zip root, create Lambda
# (Node 20) handler index.handler, env GOOGLE_SHEETS_API_KEY, SPREADSHEET_ID, BUCKET,
# optional CLOUDFRONT_DISTRIBUTION_ID; EventBridge rate(1 hour) or cron trigger.
param(
  [string] $Bucket = "strength-training-tracker",
  [string] $Region = "ca-central-1",
  [string] $DistributionId = $env:CLOUDFRONT_DISTRIBUTION_ID
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not (Test-Path "dist/index.html")) {
  Write-Error "dist/index.html missing. Run: npm run build"
}

aws s3 sync dist/ "s3://$Bucket/" --delete --region $Region --no-cli-pager
aws s3 cp "public/data/latest.json" "s3://$Bucket/data/latest.json" --region $Region --content-type "application/json" --cache-control "max-age=60" --no-cli-pager

if ($DistributionId) {
  aws cloudfront create-invalidation --distribution-id $DistributionId --paths "/*" "/data/latest.json" --no-cli-pager | Out-Null
  Write-Host "Invalidated CloudFront $DistributionId"
} else {
  Write-Host "Set CLOUDFRONT_DISTRIBUTION_ID to auto-invalidate after deploy."
}

Write-Host "Done. s3://$Bucket/"
