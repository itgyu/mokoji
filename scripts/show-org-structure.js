/**
 * organizations 컬렉션 구조 확인 스크립트
 */

const { initializeApp } = require('firebase/app')
const { getFirestore, collection, getDocs } = require('firebase/firestore')

const firebaseConfig = {
  apiKey: "AIzaSyB-KFGyCaCi331p3wqIQ5M6xjlQmoxnL3I",
  authDomain: "it-s-campers-95640.firebaseapp.com",
  projectId: "it-s-campers-95640",
  storageBucket: "it-s-campers-95640.firebasestorage.app",
  messagingSenderId: "649129244679",
  appId: "1:649129244679:web:68e5f10df7ece94fe3d2a2"
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

async function showOrgStructure() {
  try {
    const orgsSnapshot = await getDocs(collection(db, 'organizations'))

    orgsSnapshot.forEach((doc) => {
      console.log('\n====== Organization Document ======')
      console.log('ID:', doc.id)
      console.log('Data:', JSON.stringify(doc.data(), null, 2))
    })

  } catch (error) {
    console.error('Error:', error)
    throw error
  }
}

showOrgStructure()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Failed:', error)
    process.exit(1)
  })
