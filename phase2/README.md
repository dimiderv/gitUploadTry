This is the second phase on my project

In phase 1 i used attribute based access control for creation of product and create a simple example of using that.
The roles are farming and retailer and it's easier if every organization has different roles. 

			Org1 => farming
			Org2 => retailing 


In this phase i'm going to add private data collections for Org1 and Org2 
It is going to be consisted of:

			* Private Collection for Org1
			* Private Collection for Org2
			* Private Collection for both together (Org1, Org2)

These are going to be created after completing the first three bullets 

	* A public ledger where everyone can read it. This can be achieved either by creating a shared collection
	 or by storing everything in to the public data ledger (I'm going to try this implementetion).
	 
INITIALIZATION HAS TO FOLLOW THESE STEPS

If you decide to have separate file for main.go and the chaincode folder you have to go on the 
project folder ex phase3 where you have folder chaincode and file main.go 
and enter command *go mod init phase3* . The main file has to look like this

				package main

				import (
					"log"

					"github.com/hyperledger/fabric-contract-api-go/contractapi"
					"phase3/chaincode"
				)

				func main() {
					assetChaincode, err := contractapi.NewChaincode(&chaincode.SmartContract{})
					if err != nil {
						log.Panicf("Error creating asset-transfer-private-data chaincode: %v", err)
					}

					if err := assetChaincode.Start(); err != nil {
						log.Panicf("Error starting asset-transfer-private-data chaincode: %v", err)
					}
				}
				
				


