'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import * as XLSX from 'xlsx'

export default function FileUpload() {
  const [file, setFile] = useState<File | null>(null)
  const [markdownText, setMarkdownText] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] || null)
    setErrorMessage(null)
    setMarkdownText(null)
  }

  const convertMarkdownToExcel = (markdownText: string) => {
    try {
      // マークダウンテーブルをパース
      const lines = markdownText
        .split('\n')
        .filter((line) => line.trim() !== '')
      const headers = lines[0]
        .split('|')
        .filter((cell) => cell !== '') // 空のセルを保持するため、trim()を削除
        .map((header) => header.trim())

      // データ行を処理（ヘッダーと区切り線をスキップ）
      const data = lines.slice(2).map((line) => {
        // 行の先頭と末尾の | を削除し、残りを | で分割
        const cells = line.replace(/^\||\|$/g, '').split('|')

        // 各セルを処理
        const values = cells.map((cell) => {
          const value = cell.trim()
          return value === '' ? '' : value.replace(/\s+/g, ' ')
        })

        // オブジェクトを作成
        return headers.reduce(
          (obj, header, index) => {
            // インデックスが範囲内の場合のみ値を設定
            obj[header] = index < values.length ? values[index] : ''
            return obj
          },
          {} as Record<string, string>
        )
      })

      // Excelワークブックを作成
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(data)

      // 列幅の自動調整
      const colWidths = headers.map((header) => ({
        wch: Math.max(
          header.length,
          ...data.map((row) => String(row[header]).length)
        ),
      }))
      ws['!cols'] = colWidths

      // ワークシートをブックに追加
      XLSX.utils.book_append_sheet(wb, ws, 'ETCデータ')

      // Excelファイルを生成してダウンロード
      XLSX.writeFile(wb, 'etc_data.xlsx')
    } catch (error) {
      console.error('Excel conversion error:', error)
      throw new Error('Excelファイルの生成に失敗しました。')
    }
  }

  const handleSubmit = async (
    e: React.FormEvent,
    format: 'markdown' | 'excel' = 'markdown'
  ) => {
    e.preventDefault()
    if (!file) {
      setErrorMessage('ファイルを選択してください。')
      return
    }

    setLoading(true)
    setErrorMessage(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('output_format', 'markdown') // 常にmarkdownで取得

    try {
      const response = await fetch('http://localhost:8000/api/v1/etc/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        let errorMessage = 'ファイル処理中にエラーが発生しました。'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch (parseError) {
          console.error('Error parsing error response:', parseError)
        }
        throw new Error(errorMessage)
      }

      const data = await response.json()
      if (format === 'excel') {
        convertMarkdownToExcel(data.markdown)
      } else {
        setMarkdownText(data.markdown)
      }
      setErrorMessage(null)
    } catch (error) {
      console.error('Error:', error)
      setErrorMessage(
        error instanceof Error
          ? error.message
          : '予期せぬエラーが発生しました。'
      )
      setMarkdownText(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center p-6">
      <h1 className="text-2xl font-bold mb-4">PDFをアップロードして解析</h1>
      <form className="w-full max-w-md space-y-4">
        <input
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          className="w-full p-2 border rounded-lg"
        />
        <div className="flex gap-4 justify-between">
          <Button
            onClick={(e) => handleSubmit(e, 'markdown')}
            variant="default"
            disabled={loading}
            className="w-48 flex items-center justify-center"
          >
            {loading ? '処理中...' : 'Markdownで表示'}
          </Button>
          <Button
            onClick={(e) => handleSubmit(e, 'excel')}
            variant="secondary"
            disabled={loading}
            className="w-48 flex items-center justify-center"
          >
            {loading ? '処理中...' : 'Excelでダウンロード'}
          </Button>
        </div>
      </form>
      {errorMessage && (
        <div className="mt-4 text-red-500 font-semibold">{errorMessage}</div>
      )}
      {markdownText && (
        <div className="mt-4 p-4 border rounded-lg w-full">
          <h2 className="text-lg font-semibold">Markdown 内容:</h2>
          <pre className="whitespace-pre-wrap text-sm">{markdownText}</pre>
        </div>
      )}
    </div>
  )
}
