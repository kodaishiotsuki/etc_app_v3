'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function FileUpload() {
  const [file, setFile] = useState<File | null>(null)
  const [markdownText, setMarkdownText] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [activeTab, setActiveTab] = useState<'markdown' | 'excel'>('markdown')

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] || null)
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
        .filter((cell) => cell !== '')
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

      // 成功時のトースト表示
      toast.success('Excelファイルのダウンロードが完了しました')
    } catch (error) {
      console.error('Excel conversion error:', error)
      toast.error('Excelファイルの生成に失敗しました')
      throw new Error('Excelファイルの生成に失敗しました。')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      toast.error('ファイルを選択してください')
      return
    }

    setLoading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('output_format', 'markdown')

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

      if (activeTab === 'excel') {
        await convertMarkdownToExcel(data.markdown)
      } else {
        setMarkdownText(data.markdown)
        toast.success('PDFの解析が完了しました', {
          duration: 3000,
        })
      }
    } catch (error) {
      console.error('Error:', error)
      const errorMsg =
        error instanceof Error
          ? error.message
          : '予期せぬエラーが発生しました。'
      toast.error(errorMsg, {
        duration: 4000,
      })
      setMarkdownText(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center p-6">
      <h1 className="text-3xl font-bold mb-4 text-center">
        ETC利用明細PDF変換ツール
      </h1>

      <form className="w-full max-w-md space-y-6">
        <div className="space-y-4">
          <Label htmlFor="file-upload" className="block text-md font-bold">
            PDFファイルを選択
          </Label>
          <div className="flex items-center justify-center w-full">
            <label
              htmlFor="file-upload"
              className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors duration-200"
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <svg
                  className="w-8 h-8 mb-3 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v9a2 2 0 01-2 2h-1"
                  />
                </svg>
                <p className="mb-2 text-sm text-gray-500">
                  <span className="font-semibold">
                    クリックしてアップロード
                  </span>
                </p>
                {file ? (
                  <p className="text-sm text-gray-500">{file.name}</p>
                ) : (
                  <p className="text-xs text-gray-500">PDF形式のファイル</p>
                )}
              </div>
              <Input
                id="file-upload"
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as 'markdown' | 'excel')}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="markdown">Markdownで表示</TabsTrigger>
            <TabsTrigger value="excel">Excelでダウンロード</TabsTrigger>
          </TabsList>
          <TabsContent value="markdown" className="mt-4">
            <Button
              onClick={handleSubmit}
              variant="default"
              disabled={loading}
              className="w-full"
            >
              {loading ? '処理中...' : 'PDFを解析'}
            </Button>
          </TabsContent>
          <TabsContent value="excel" className="mt-4">
            <Button
              onClick={handleSubmit}
              variant="default"
              disabled={loading}
              className="w-full"
            >
              {loading ? '処理中...' : 'PDFを解析してExcelでダウンロード'}
            </Button>
          </TabsContent>
        </Tabs>
      </form>

      {markdownText && activeTab === 'markdown' && (
        <div className="mt-4 p-4 border rounded-lg w-full">
          <h2 className="text-lg font-semibold">出力内容</h2>
          <pre className="whitespace-pre-wrap text-sm">{markdownText}</pre>
        </div>
      )}
    </div>
  )
}
