import * as cdk from 'aws-cdk-lib'
import { CfnOutput, RemovalPolicy, Stack, type StackProps, Tags } from 'aws-cdk-lib'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins'
import * as cognito from 'aws-cdk-lib/aws-cognito'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as s3 from 'aws-cdk-lib/aws-s3'
import type { Construct } from 'constructs'
import { stackBaseName, suggestedTenantHostname, type DeployContext } from './config'

export interface StrengthTrackerStackProps extends StackProps {
  readonly tenantSlug: string
  readonly stage: string
  readonly productPrefix: string
  readonly destructiveDeletes: boolean
  /** Optional apex domain for future per-tenant DNS (see `suggestedTenantHostname`). */
  readonly baseDomain?: string
  readonly appCallbackUrls: string[]
  readonly appLogoutUrls: string[]
}

export class StrengthTrackerStack extends Stack {
  constructor(scope: Construct, id: string, props: StrengthTrackerStackProps) {
    super(scope, id, props)

    const {
      tenantSlug,
      stage,
      productPrefix,
      destructiveDeletes,
      baseDomain,
      appCallbackUrls,
      appLogoutUrls,
    } = props

    const ctx: DeployContext = { tenantSlug, stage, productPrefix }
    const base = stackBaseName(ctx)
    const removalPolicy = destructiveDeletes ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN

    const tagScope = (s: Construct, extra?: Record<string, string>) => {
      Tags.of(s).add('Project', 'StrengthTracker')
      Tags.of(s).add('Tenant', tenantSlug)
      Tags.of(s).add('Stage', stage)
      Tags.of(s).add('ManagedBy', 'CDK')
      if (extra) {
        for (const [k, v] of Object.entries(extra)) Tags.of(s).add(k, v)
      }
    }

    tagScope(this)

    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy,
      autoDeleteObjects: destructiveDeletes,
    })
    tagScope(siteBucket, { Role: 'static-site-and-program-json' })

    const distribution = new cloudfront.Distribution(this, 'SiteDistribution', {
      comment: `StrengthTracker ${tenantSlug} ${stage}`,
      defaultRootObject: 'index.html',
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        compress: true,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.seconds(0),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.seconds(0),
        },
      ],
    })
    tagScope(distribution, { Role: 'cdn' })

    const tableName = `${base}-training-log`.replace(/[^a-z0-9-]/g, '-').slice(0, 255)
    const trainingLog = new dynamodb.Table(this, 'TrainingLogTable', {
      tableName,
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy,
    })
    tagScope(trainingLog, { Role: 'user-training-log' })

    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `${base}-users`.slice(0, 128),
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      passwordPolicy: {
        minLength: 12,
        requireDigits: true,
        requireLowercase: true,
        requireUppercase: true,
        requireSymbols: false,
      },
      removalPolicy,
    })
    tagScope(userPool, { Role: 'auth' })

    const userPoolClient = userPool.addClient('WebClient', {
      userPoolClientName: `${base}-web`.slice(0, 128),
      generateSecret: false,
      authFlows: { userSrp: true, userPassword: true },
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: appCallbackUrls,
        logoutUrls: appLogoutUrls,
      },
      supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.COGNITO],
    })

    const domainPrefix = base.replace(/[^a-z0-9-]/g, '-').slice(0, 63)
    const hostedDomain = userPool.addDomain('HostedUi', {
      cognitoDomain: { domainPrefix: domainPrefix },
    })

    new CfnOutput(this, 'SiteBucketName', { value: siteBucket.bucketName })
    new CfnOutput(this, 'CloudFrontDomain', { value: distribution.distributionDomainName })
    new CfnOutput(this, 'CloudFrontDistributionId', { value: distribution.distributionId })
    new CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId })
    new CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId })
    new CfnOutput(this, 'CognitoHostedUiBaseUrl', {
      value: `https://${hostedDomain.domainName}.auth.${this.region}.amazoncognito.com`,
    })
    new CfnOutput(this, 'TrainingLogTableName', { value: trainingLog.tableName })
    new CfnOutput(this, 'StackBaseName', { value: base })
    new CfnOutput(this, 'ProgramDataKey', {
      value: 'data/latest.json',
      description: 'Upload sheet snapshot here in the site bucket (same origin as SPA).',
    })

    if (baseDomain) {
      new CfnOutput(this, 'SuggestedTenantHostname', {
        value: suggestedTenantHostname(tenantSlug, baseDomain),
        description: 'Future: ACM + alternate domain on CloudFront for this tenant.',
      })
    }
  }
}
