import csv, io, os, sys

input_file = "reports/dtienbac/Traffic_sources.csv"
output_file = "src/data/traffic_geo.js"

def sniff_delimiter(sample_bytes: bytes, fallback=","):
    try:
        dialect = csv.Sniffer().sniff(sample_bytes.decode("utf-8", errors="ignore"))
        return dialect.delimiter
    except Exception:
        return fallback

if not os.path.exists(input_file):
    print(f"Không tìm thấy file: {input_file}")
    sys.exit(1)

with open(input_file, "rb") as fb:
    raw = fb.read()
if not raw.strip():
    print("CSV rỗng.")
    sys.exit(1)

# Dò delimiter
sample = raw[:4096]
delimiter = sniff_delimiter(sample)
text = raw.decode("utf-8-sig", errors="replace")  # bỏ BOM nếu có

# Tạo DictReader
f = io.StringIO(text)
reader = csv.DictReader(f, delimiter=delimiter)
if not reader.fieldnames:
    print("Không đọc được header. Kiểm tra dòng đầu của CSV.")
    sys.exit(1)

# Chuẩn hoá header: strip khoảng trắng 2 bên
norm_map = {h: h.strip() for h in reader.fieldnames}
fieldnames = [norm_map[h] for h in reader.fieldnames]

rows = []
for row in reader:
    # loại bỏ dòng trống hoàn toàn
    if not any(v.strip() for v in row.values() if isinstance(v, str)):
        continue
    # map key về header đã strip
    fixed = {norm_map[k]: v.strip() if isinstance(v, str) else v for k, v in row.items()}
    rows.append(fixed)

print("== DIAGNOSTIC ==")
print("Delimiter:", repr(delimiter))
print("Headers CSV:", fieldnames)
print("Số dòng dữ liệu:", len(rows))
if rows[:1]:
    print("Mẫu dòng đầu:", rows[0])

# Kiểm tra cột cần có
required = [
    "insightTrafficSourceType",
    "views",
    "estimatedMinutesWatched",
    "averageViewDuration",
    "averageViewPercentage",
    "engagedViews",
]
missing = [c for c in required if c not in fieldnames]
if missing:
    print("⚠ Thiếu cột:", missing)
    print("Gợi ý: mở file CSV và so sánh header chính xác.")
    # vẫn tiếp tục nếu người dùng muốn map thủ công:
    # sys.exit(1)

# Ghi JS
os.makedirs(os.path.dirname(output_file), exist_ok=True)
with open(output_file, "w", encoding="utf-8") as out:
    out.write("export const TrafficSources = [\n")
    for r in rows:
        try:
            insight = r.get("insightTrafficSourceType", "")
            views = int(float(r.get("views", 0) or 0))
            emw = int(float(r.get("estimatedMinutesWatched", 0) or 0))
            avd = int(float(r.get("averageViewDuration", 0) or 0))
            avp = float(r.get("averageViewPercentage", 0) or 0)
            eng = int(float(r.get("engagedViews", 0) or 0))
        except ValueError:
            # nếu có giá trị rỗng / "NaN", chuyển về 0
            insight = r.get("insightTrafficSourceType", "")
            views = int(float(r.get("views", "0") or 0))
            emw = int(float(r.get("estimatedMinutesWatched", "0") or 0))
            avd = int(float(r.get("averageViewDuration", "0") or 0))
            avp = float(r.get("averageViewPercentage", "0") or 0)
            eng = int(float(r.get("engagedViews", "0") or 0))

        out.write("  {\n")
        out.write(f"    insightTrafficSourceType: \"{insight}\",\n")
        out.write(f"    views: {views},\n")
        out.write(f"    estimatedMinutesWatched: {emw},\n")
        out.write(f"    averageViewDuration: {avd},\n")
        out.write(f"    averageViewPercentage: {avp:.2f},\n")
        out.write(f"    engagedViews: {eng},\n")
        out.write("  },\n")
    out.write("];\n")

print(f"Xuất xong sang {output_file}")
