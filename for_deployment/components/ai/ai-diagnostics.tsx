

'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Brain, AlertCircle, CheckCircle, Clock, Upload, Sparkles } from 'lucide-react'

interface DiagnosticsResult {
  id: string
  timestamp: string
  analysis: string
  confidence: number
  recommendations: string[]
  severity: 'mild' | 'moderate' | 'severe'
  processingTime: string
  aiVersion: string
  disclaimer: string
}

interface AIDiagnosticsProps {
  userRole: string
  userId: string
}

export default function AIDiagnostics({ userRole, userId }: AIDiagnosticsProps) {
  const [symptoms, setSymptoms] = useState('')
  const [patientAge, setPatientAge] = useState('')
  const [medicalHistory, setMedicalHistory] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<DiagnosticsResult | null>(null)
  const [error, setError] = useState('')

  const handleDiagnostics = async () => {
    if (!symptoms.trim()) {
      setError('Please describe your symptoms')
      return
    }

    setIsLoading(true)
    setError('')
    setResult(null)

    try {
      const response = await fetch('/api/ai-diagnostics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          symptoms,
          patientAge,
          medicalHistory,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setResult(data.data)
      } else {
        setError(data.error || 'Failed to process diagnostics')
      }
    } catch (err) {
      setError('Network error - please try again')
    } finally {
      setIsLoading(false)
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'mild': return 'bg-green-100 text-green-800'
      case 'moderate': return 'bg-yellow-100 text-yellow-800'  
      case 'severe': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600'
    if (confidence >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Brain className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                AI-Powered Dental Diagnostics
                <Sparkles className="w-4 h-4 text-purple-500" />
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Get instant AI analysis of dental symptoms - completely free
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {/* Symptoms Input */}
            <div className="space-y-2">
              <Label htmlFor="symptoms">
                Describe your symptoms *
                {userRole === 'dentist' && (
                  <span className="text-xs text-muted-foreground ml-2">
                    (Patient symptoms)
                  </span>
                )}
              </Label>
              <Textarea
                id="symptoms"
                placeholder="e.g., Sharp pain in upper left tooth, sensitivity to cold drinks, gum swelling..."
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                rows={3}
              />
            </div>

            {/* Additional Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="age">Patient Age (optional)</Label>
                <Input
                  id="age"
                  type="number"
                  placeholder="25"
                  value={patientAge}
                  onChange={(e) => setPatientAge(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="history">Medical History (optional)</Label>
                <Input
                  id="history"
                  placeholder="Diabetes, allergies, medications..."
                  value={medicalHistory}
                  onChange={(e) => setMedicalHistory(e.target.value)}
                />
              </div>
            </div>

            {/* Action Button */}
            <div className="flex justify-between items-center pt-4">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Fast • Accurate • Free
              </div>
              <Button 
                onClick={handleDiagnostics}
                disabled={isLoading || !symptoms.trim()}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {isLoading ? (
                  <>
                    <Brain className="w-4 h-4 mr-2 animate-pulse" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Get AI Diagnosis
                  </>
                )}
              </Button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-red-700">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">{error}</span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                AI Analysis Results
              </div>
              <Badge className={getSeverityColor(result.severity)}>
                {result.severity.toUpperCase()}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Analysis */}
            <div>
              <h4 className="font-medium mb-2">Analysis</h4>
              <p className="text-sm text-muted-foreground bg-blue-50 p-3 rounded-lg">
                {result.analysis}
              </p>
            </div>

            {/* Confidence Score */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-medium">Confidence Score</h4>
                <span className={`font-bold ${getConfidenceColor(result.confidence)}`}>
                  {result.confidence}%
                </span>
              </div>
              <Progress value={result.confidence} className="h-2" />
            </div>

            {/* Recommendations */}
            <div>
              <h4 className="font-medium mb-3">Recommendations</h4>
              <ul className="space-y-2">
                {result.recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Metadata */}
            <div className="bg-gray-50 p-3 rounded-lg space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Processing Time: {result.processingTime}
                </span>
                <span>AI Version: {result.aiVersion}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                <AlertCircle className="w-3 h-3 inline mr-1" />
                {result.disclaimer}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

