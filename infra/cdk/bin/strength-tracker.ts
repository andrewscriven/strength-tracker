#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
import { StrengthTrackerStack } from '../lib/strength-tracker-stack'

const app = new cdk.App()

const tenantSlug = String(app.node.tryGetContext('tenantSlug') ?? 'default')
const stage = String(app.node.tryGetContext('stage') ?? 'dev')
const productPrefix = String(app.node.tryGetContext('productPrefix') ?? 'ST')
const destructiveDeletes = Boolean(app.node.tryGetContext('destructiveDeletes') ?? false)
const baseDomainRaw = app.node.tryGetContext('baseDomain')
const baseDomain =
  typeof baseDomainRaw === 'string' && baseDomainRaw.trim().length > 0 ? baseDomainRaw.trim() : undefined

const callbackUrls = app.node.tryGetContext('appCallbackUrls')
const logoutUrls = app.node.tryGetContext('appLogoutUrls')

const appCallbackUrls = Array.isArray(callbackUrls)
  ? callbackUrls.map(String)
  : ['http://localhost:5173/']
const appLogoutUrls = Array.isArray(logoutUrls) ? logoutUrls.map(String) : ['http://localhost:5173/']

/** One stack per (stage × tenant); deploy another stack for another client later. */
const stackId = `${productPrefix}-${stage}-${tenantSlug}-Core`

new StrengthTrackerStack(app, stackId, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'ca-central-1',
  },
  tenantSlug,
  stage,
  productPrefix,
  destructiveDeletes,
  baseDomain,
  appCallbackUrls,
  appLogoutUrls,
  description: `StrengthTracker core (${tenantSlug}, ${stage}) — web, auth shell, program bucket, training log table`,
})

app.synth()
