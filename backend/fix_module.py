from pathlib import Path


APP_MODULE = Path(__file__).resolve().parent / "src" / "app.module.ts"


def main() -> None:
    content = APP_MODULE.read_text(encoding="utf-8")
    APP_MODULE.write_text(content, encoding="utf-8")


if __name__ == "__main__":
    main()
