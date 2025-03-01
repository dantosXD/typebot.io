import { Credentials as CredentialsFromDb } from 'db'
import { OAuth2Client, Credentials } from 'google-auth-library'
import { GoogleSheetsCredentialsData } from 'models'
import { decrypt, encrypt } from 'utils'
import prisma from './prisma'

export const oauth2Client = new OAuth2Client(
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXTAUTH_URL}/api/credentials/google-sheets/callback`
)

export const getAuthenticatedGoogleClient = async (
  userId: string,
  credentialsId: string
): Promise<
  { client: OAuth2Client; credentials: CredentialsFromDb } | undefined
> => {
  const credentials = (await prisma.credentials.findFirst({
    where: { id: credentialsId, workspace: { members: { some: { userId } } } },
  })) as CredentialsFromDb | undefined
  if (!credentials) return
  const data = decrypt(
    credentials.data,
    credentials.iv
  ) as GoogleSheetsCredentialsData

  oauth2Client.setCredentials(data)
  oauth2Client.on('tokens', updateTokens(credentialsId, data))
  return { client: oauth2Client, credentials }
}

const updateTokens =
  (credentialsId: string, existingCredentials: GoogleSheetsCredentialsData) =>
  async (credentials: Credentials) => {
    const newCredentials = {
      refresh_token: existingCredentials.refresh_token,
      ...credentials,
    }
    const { encryptedData, iv } = encrypt(newCredentials)
    await prisma.credentials.update({
      where: { id: credentialsId },
      data: { data: encryptedData, iv },
    })
  }
