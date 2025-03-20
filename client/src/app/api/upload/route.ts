import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const outputFormat = (formData.get('output_format') as string) || 'markdown'

    if (!file) {
      return NextResponse.json(
        { error: 'ファイルが選択されていません。' },
        { status: 400 }
      )
    }

    const backendFormData = new FormData()
    backendFormData.append('file', file)
    backendFormData.append('output_format', outputFormat)

    const response = await fetch('http://localhost:8000/api/v1/etc/upload', {
      method: 'POST',
      body: backendFormData,
    })

    const contentType = response.headers.get('content-type')

    if (!response.ok) {
      let errorMessage = 'バックエンド処理中にエラーが発生しました。'
      try {
        if (contentType?.includes('application/json')) {
          const errorData = await response.json()
          errorMessage = errorData.detail || errorData.error || errorMessage
        } else {
          const errorText = await response.text()
          errorMessage = errorText || errorMessage
        }
      } catch (parseError) {
        console.error('Error parsing error response:', parseError)
      }
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      )
    }

    if (outputFormat === 'excel') {
      console.log('Excel response:', response)
      const blob = await response.blob()
      return new Response(blob, {
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename=etc_data.xlsx',
        },
      })
    } else {
      const data = await response.json()
      return NextResponse.json(data)
    }
  } catch (error) {
    console.error('Error in API route:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'サーバーエラーが発生しました。',
      },
      { status: 500 }
    )
  }
}
