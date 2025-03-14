'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAnchorWallet } from '@solana/wallet-adapter-react'
import { Connection, PublicKey } from '@solana/web3.js'
import { Program, AnchorProvider } from '@project-serum/anchor'
import { IDL } from '../idl/voting_program' // Your program's IDL

// Your program ID
const PROGRAM_ID = new PublicKey("7BwU8mJrTN1EpCaJFnYnFRrxKrW66we6Mgv3hpVeqnbf")
// Your voting state account (this would be created during initialization)
const VOTING_STATE = new PublicKey("your_voting_state_account_address")

export default function RealVotingUI() {
  const wallet = useAnchorWallet()
  const [voteCounts, setVoteCounts] = useState<Record<number, number>>({})
  const [totalVotes, setTotalVotes] = useState(0)
  const [hasVoted, setHasVoted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [program, setProgram] = useState<Program | null>(null)
  
  const options = [
    { id: 1, name: "Option A", description: "First voting option" },
    { id: 2, name: "Option B", description: "Second voting option" },
    { id: 3, name: "Option C", description: "Third voting option" }
  ]

  // Initialize connection to Solana and the program
  useEffect(() => {
    if (wallet) {
      const connection = new Connection("https://api.devnet.solana.com")
      const provider = new AnchorProvider(connection, wallet, {})
      const program = new Program(IDL, PROGRAM_ID, provider)
      setProgram(program)
      
      // Fetch initial data
      fetchVoteData(program)
      checkVoterStatus(program, wallet.publicKey)
    }
  }, [wallet])
  
  // Fetch real vote data from the blockchain
  const fetchVoteData = async (program: Program) => {
    try {
      setLoading(true)
      const votingState = await program.account.votingState.fetch(VOTING_STATE)
      
      // Get vote counts for each option
      const counts: Record<number, number> = {}
      votingState.optionVotes.forEach((count, index) => {
        counts[index + 1] = count.toNumber()
      })
      
      setVoteCounts(counts)
      setTotalVotes(votingState.totalVotes.toNumber())
      setLoading(false)
    } catch (error) {
      console.error("Error fetching vote data:", error)
      setLoading(false)
    }
  }
  
  // Check if the current user has already voted
  const checkVoterStatus = async (program: Program, publicKey: PublicKey) => {
    try {
      const [voterInfoPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("voter-info"), publicKey.toBuffer()],
        program.programId
      )
      
      try {
        const voterInfo = await program.account.voterInfo.fetch(voterInfoPda)
        setHasVoted(voterInfo.hasVoted)
      } catch (e) {
        // Account doesn't exist yet, user hasn't voted
        setHasVoted(false)
      }
    } catch (error) {
      console.error("Error checking voter status:", error)
    }
  }
  
  // Cast a vote on the blockchain
  const handleVote = async (optionId: number) => {
    if (!program || !wallet || hasVoted || loading) return
    
    setLoading(true)
    try {
      // Get the PDA for the voter info account
      const [voterInfoPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("voter-info"), wallet.publicKey.toBuffer()],
        program.programId
      )
      
      // Call the cast_vote function on your Solana program
      const tx = await program.methods.castVote(optionId)
        .accounts({
          votingState: VOTING_STATE,
          voter: wallet.publicKey,
          voterInfo: voterInfoPda,
          payer: wallet.publicKey, // User pays for their own transaction
          systemProgram: SystemProgram.programId,
        })
        .rpc()
      
      console.log("Transaction signature:", tx)
      console.log("View on Solana Explorer:", `https://explorer.solana.com/tx/${tx}?cluster=devnet`)
      
      // Refresh the data
      await fetchVoteData(program)
      await checkVoterStatus(program, wallet.publicKey)
    } catch (error) {
      console.error("Error casting vote:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white p-6">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Solana Voting Platform</h1>
          <p className="text-gray-400">Cast your vote on the blockchain</p>
          
          {!wallet && (
            <Button className="mt-4">Connect Wallet</Button>
          )}
        </div>
        
        {wallet && (
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Voting Dashboard</span>
                <Badge variant="outline">{totalVotes} votes</Badge>
              </CardTitle>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {options.map(option => {
                const votes = voteCounts[option.id] || 0
                const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0
                
                return (
                  <div 
                    key={option.id} 
                    className="p-4 rounded-lg border border-gray-700 hover:border-gray-500"
                  >
                    <div className="flex justify-between mb-2">
                      <h3 className="font-medium">{option.name}</h3>
                      <span className="text-sm">{votes} votes ({percentage}%)</span>
                    </div>
                    
                    <div className="h-2 w-full bg-gray-700 rounded-full mb-3">
                      <div 
                        className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-in-out" 
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    
                    <Button 
                      onClick={() => handleVote(option.id)}
                      disabled={hasVoted || loading}
                      variant="outline"
                      className="w-full"
                    >
                      {loading ? 'Processing...' : 'Vote'}
                    </Button>
                  </div>
                )
              })}
              
              {hasVoted && (
                <div className="text-center mt-4 text-sm text-gray-400">
                  You have already voted. Contact an admin to reset your vote.
                </div>
              )}
            </CardContent>
          </Card>
        )}
        
        <div className="mt-4 text-center text-xs text-gray-500">
          <p>Connected to Solana Program: {PROGRAM_ID.toString()}</p>
          {wallet && (
            <p className="mt-1">Your wallet: {wallet.publicKey.toString().slice(0, 4)}...{wallet.publicKey.toString().slice(-4)}</p>
          )}
        </div>
      </div>
    </div>
  )
}