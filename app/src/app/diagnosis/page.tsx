import React from 'react'
import { DiagnosisWizard } from './components/DiagnosisWizard'

export default function DiagnosisPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4">
        <DiagnosisWizard />
      </div>
    </main>
  )
}
