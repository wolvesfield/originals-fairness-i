import { Contract, JsonRpcProvider } from 'ethers'
import { getLatestLocalRootHash } from '../src/db/db'

const ROOT_CONTRACT_ABI = [
  'function getRootHash() view returns (bytes32)'
]

function normalizeHash(value: string): string {
  const trimmed = value.trim().toLowerCase()
  if (!trimmed) return ''
  return trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`
}

async function verifySmartContractRoot(): Promise<void> {
  const rpcUrl = process.env.ETHEREUM_RPC_URL
  const contractAddress = process.env.CASINO_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000'

  if (!rpcUrl) {
    throw new Error('Missing ETHEREUM_RPC_URL environment variable.')
  }

  const localRootHash = getLatestLocalRootHash()
  if (!localRootHash) {
    throw new Error('No local root hash found in SQLite. Insert a root hash using setLocalRootHash first.')
  }

  const provider = new JsonRpcProvider(rpcUrl)
  const contract = new Contract(contractAddress, ROOT_CONTRACT_ABI, provider)

  const onChainRootHashRaw = await contract.getRootHash() as string

  const onChainRootHash = normalizeHash(onChainRootHashRaw)
  const localRootHashNormalized = normalizeHash(localRootHash)

  const match = onChainRootHash === localRootHashNormalized

  console.log('Root verification result:')
  console.log(`  Contract:   ${contractAddress}`)
  console.log(`  On-chain:   ${onChainRootHash}`)
  console.log(`  Local DB:   ${localRootHashNormalized}`)
  console.log(`  Match:      ${match ? 'YES' : 'NO'}`)

  if (!match) {
    throw new Error('On-chain root hash does not match local SQLite root hash.')
  }
}

verifySmartContractRoot().catch((error) => {
  console.error('Smart contract verification failed:', error)
  process.exit(1)
})
