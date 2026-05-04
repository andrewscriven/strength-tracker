import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { fetchSheetDataFromGoogle } from '../src/googleSheetsFetch'

const s3 = new S3Client({})
const cf = new CloudFrontClient({})

export const handler = async (): Promise<{ statusCode: number; body: string }> => {
  const key = process.env.GOOGLE_SHEETS_API_KEY
  const spreadsheetId =
    process.env.SPREADSHEET_ID ?? '1Ux426fnSNs_w6M_yEECAOJ332XJ9GdoZe_CTYomCGHA'
  const bucket = process.env.BUCKET
  if (!key) throw new Error('Missing GOOGLE_SHEETS_API_KEY')
  if (!bucket) throw new Error('Missing BUCKET')

  const data = await fetchSheetDataFromGoogle(key, spreadsheetId)
  const body = JSON.stringify(data)

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: 'data/latest.json',
      Body: body,
      ContentType: 'application/json',
      CacheControl: 'max-age=60',
    }),
  )

  const distributionId = process.env.CLOUDFRONT_DISTRIBUTION_ID
  if (distributionId) {
    await cf.send(
      new CreateInvalidationCommand({
        DistributionId: distributionId,
        InvalidationBatch: {
          CallerReference: `st-sheet-${Date.now()}`,
          Paths: { Quantity: 1, Items: ['/data/latest.json'] },
        },
      }),
    )
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      ok: true,
      fetchedAt: data.fetchedAt,
      tabs: data.tabs.length,
      weeks: data.parsedWeeks.length,
    }),
  }
}
