import logging
import tempfile
from typing import Optional

import pandas as pd
import pymupdf4llm
from fastapi import APIRouter, File, HTTPException, Response, UploadFile

from app.schemas.etc import ETCResponse

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/upload", response_model=None)
async def upload_pdf(
    file: UploadFile = File(...), output_format: Optional[str] = "markdown"
):
    try:
        if not file:
            logger.error("No file uploaded")
            raise HTTPException(status_code=400, detail="No file uploaded")

        logger.debug(f"Output format: {output_format}")

        markdown_text = ""
        formatted_data = []

        # 一時ファイルとして保存して処理
        with tempfile.NamedTemporaryFile(delete=True) as temp_pdf:
            logger.debug("Saving uploaded file to temporary location")
            content = await file.read()
            temp_pdf.write(content)
            temp_pdf.flush()
            logger.debug(f"Temporary file created at {temp_pdf.name}")

            # PDFからテキストを抽出
            raw_text = pymupdf4llm.to_markdown(temp_pdf.name)

            # テキストを解析して新しい形式に変換
            lines = raw_text.split("\n")
            formatted_lines = []

            # 新しいヘッダーを追加
            headers = [
                "カード番号",
                "利用月",
                "利用年月日",
                "車種",
                "車両番号",
                "入口IC",
                "出口IC",
                "割引前の金額",
                "割引後の金額",
            ]
            formatted_lines.append("| " + " | ".join(headers) + " |")
            formatted_lines.append("|" + "---|" * len(headers))

            # データ行を処理
            for line in lines:
                if (
                    "|" in line
                    and not line.startswith("|---")
                    and "利用年月日" not in line
                ):
                    parts = line.strip().split("|")
                    if len(parts) >= 5:
                        try:
                            # 日付とIC情報を分解
                            date_ic_info = parts[1].strip().split()
                            if len(date_ic_info) >= 5:
                                # 日付を20240902形式に変換
                                date_parts = date_ic_info[0].split("/")
                                year = f"20{date_parts[0]}"
                                month = date_parts[1].zfill(2)
                                day = date_parts[2].zfill(2)
                                formatted_date = f"{year}{month}{day}"
                                month_number = str(int(date_parts[1]))

                                # ICの情報を抽出
                                ic_info = []
                                for x in date_ic_info:
                                    if (
                                        ":" not in x
                                        and "/" not in x
                                        and not x.replace(" ", "").isdigit()
                                    ):
                                        ic_info.append(x)

                                # ICの情報を処理
                                if len(ic_info) == 1:
                                    entry_ic = ""
                                    exit_ic = ic_info[0]
                                elif len(ic_info) >= 2:
                                    entry_ic = ic_info[0]
                                    exit_ic = ic_info[-1]
                                else:
                                    entry_ic = ""
                                    exit_ic = ""

                                entry_ic = entry_ic.replace("自)", "").strip()
                                exit_ic = exit_ic.replace("至)", "").strip()

                            # 料金情報を分解
                            fee_info = parts[2].strip().split()
                            if fee_info:
                                if len(fee_info) >= 2 and fee_info[0].endswith(","):
                                    original_fee = (
                                        fee_info[0].rstrip(",") + "," + fee_info[1]
                                    )
                                else:
                                    original_fee = fee_info[0]
                                original_fee = original_fee.replace("(", "").replace(
                                    ")", ""
                                )

                                if len(fee_info) >= 2 and fee_info[-2].endswith(","):
                                    final_fee = (
                                        fee_info[-2].rstrip(",") + "," + fee_info[-1]
                                    )
                                else:
                                    final_fee = fee_info[-1]
                            else:
                                original_fee = ""
                                final_fee = ""

                            # 車両情報を分解
                            vehicle_info = parts[4].strip().split()
                            if len(vehicle_info) >= 3:
                                vehicle_type = vehicle_info[0]
                                vehicle_number = vehicle_info[1]
                                card_number = vehicle_info[2]

                                # 新しい形式で行を追加
                                formatted_line = (
                                    f"| {card_number} | {month_number} | "
                                    f"{formatted_date} | {vehicle_type} | "
                                    f"{vehicle_number} | {entry_ic} | {exit_ic} | "
                                    f"{original_fee} | {final_fee} |"
                                )
                                formatted_lines.append(formatted_line)

                                # エクセル出力用のデータを保存
                                formatted_data.append(
                                    {
                                        "カード番号": card_number,
                                        "利用月": month_number,
                                        "利用年月日": formatted_date,
                                        "車種": vehicle_type,
                                        "車両番号": vehicle_number,
                                        "入口IC": entry_ic,
                                        "出口IC": exit_ic,
                                        "割引前の金額": original_fee,
                                        "割引後の金額": final_fee,
                                    }
                                )

                        except Exception as e:
                            logger.warning(f"行の解析中にエラーが発生しました: {e}")
                            continue

            markdown_text = "\n".join(formatted_lines)

        # 出力形式に応じてレスポンスを返す
        if output_format == "excel":
            try:
                if not formatted_data:
                    raise HTTPException(
                        status_code=400,
                        detail="処理可能なデータが見つかりませんでした。",
                    )

                # DataFrameを作成
                df = pd.DataFrame(formatted_data)

                # 一時的なファイルとしてExcelを保存
                with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as tmp:
                    with pd.ExcelWriter(tmp.name, engine="openpyxl") as writer:
                        df.to_excel(writer, index=False, sheet_name="ETCデータ")

                    # ファイルを読み込んでバイナリデータとして取得
                    tmp.seek(0)
                    with open(tmp.name, "rb") as f:
                        excel_data = f.read()

                return Response(
                    content=excel_data,
                    media_type=(
                        "application/vnd.openxmlformats-officedocument"
                        ".spreadsheetml.sheet"
                    ),
                    headers={
                        "Content-Disposition": "attachment; filename=etc_data.xlsx",
                        "Content-Length": str(len(excel_data)),
                    },
                )

            except Exception as e:
                logger.exception("Excel file creation error")
                raise HTTPException(
                    status_code=500,
                    detail=f"Excelファイルの生成に失敗しました: {str(e)}",
                )
        else:
            return ETCResponse(markdown=markdown_text)

    except Exception as e:
        logger.exception("An error occurred during file processing")
        raise HTTPException(status_code=500, detail=str(e))
