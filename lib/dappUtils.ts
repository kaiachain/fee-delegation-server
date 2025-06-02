import { prisma } from "./prisma";

export async function getDappByApiKey(apiKey: string) {
  const apiKeyRecord = await prisma.apiKey.findUnique({
    where: { key: apiKey },
    include: {
      dapp: {
        include: {
          contracts: true,
          senders: true
        }
      }
    }
  });

  return apiKeyRecord?.dapp || null;
} 