#!/usr/bin/env python3
"""
Fast, robust locale translation script for newly synced translation files and keys.
- Translates only newly added keys and namespace files.
- Reuses existing repository translations for 100% term consistency.
- Uses domain glossary for PM/UI terms (e.g., Recurring -> 重复 in zh).
- Batches remaining strings with token protection ({{var}}, <tag>) for rapid translation.
"""

import os
import sys
import json
import re
import time
import subprocess
import urllib.request
import urllib.parse
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
LOCALES_DIR = ROOT_DIR / "public" / "locales"
SOURCE_LANG = "en"

LANG_CONFIG = {
    "alb": {"code": "sq", "name": "Albanian"},
    "de": {"code": "de", "name": "German"},
    "es": {"code": "es", "name": "Spanish"},
    "pt": {"code": "pt", "name": "Portuguese"},
    "zh": {"code": "zh-CN", "name": "Chinese (Simplified)"},
    "pl": {"code": "pl", "name": "Polish"},
    "fr": {"code": "fr", "name": "French"},
}

GLOSSARY = {
    "Recurring": {
        "alb": "E përsëritur",
        "de": "Wiederkehrend",
        "es": "Recurrente",
        "pt": "Recorrente",
        "zh": "重复",
        "pl": "Cykliczne",
        "fr": "Récurrent",
    },
    "Subtasks": {
        "alb": "Nëndetyrat",
        "de": "Unteraufgaben",
        "es": "Subtareas",
        "pt": "Subtarefas",
        "zh": "子任务",
        "pl": "Podzadania",
        "fr": "Sous-tâches",
    },
    "Subtask": {
        "alb": "Nëndetyrë",
        "de": "Unteraufgabe",
        "es": "Subtarea",
        "pt": "Subtarefa",
        "zh": "子任务",
        "pl": "Podzadanie",
        "fr": "Sous-tâche",
    },
    "Rollup": {
        "alb": "Përmbledhje",
        "de": "Rollup",
        "es": "Acumulado",
        "pt": "Acumulado",
        "zh": "汇总",
        "pl": "Zestawienie",
        "fr": "Cumul",
    },
    "Client Portal": {
        "alb": "Portali i Klientit",
        "de": "Kundenportal",
        "es": "Portal de Clientes",
        "pt": "Portal do Cliente",
        "zh": "客户门户",
        "pl": "Portal klienta",
        "fr": "Portail client",
    },
    "Order No": {
        "alb": "Nr. i Porosisë",
        "de": "Bestell-Nr.",
        "es": "N.º de pedido",
        "pt": "Nº do Pedido",
        "zh": "订单号",
        "pl": "Nr zamówienia",
        "fr": "N° de commande",
    },
    "Pro": {
        "alb": "Pro",
        "de": "Pro",
        "es": "Pro",
        "pt": "Pro",
        "zh": "专业版",
        "pl": "Pro",
        "fr": "Pro",
    },
    "Worklenz": {
        "alb": "Worklenz",
        "de": "Worklenz",
        "es": "Worklenz",
        "pt": "Worklenz",
        "zh": "Worklenz",
        "pl": "Worklenz",
        "fr": "Worklenz",
    },
    "Phase Color": {
        "alb": "Ngjyra e Fazës",
        "de": "Phasenfarbe",
        "es": "Color de la Fase",
        "pt": "Cor da Fase",
        "zh": "阶段颜色",
        "pl": "Kolor fazy",
        "fr": "Couleur de la phase",
    },
}

KEEP_AS_IS = {
    "*", "KB", "MB", "GB", "TB", "/month", "/year", "/page", "% Used", "Total $", "UTIL",
    "Slack", "Microsoft Teams", "Teams", "GitHub", "LinkedIn", "Google", "Apple", "Excel",
    "YouTube", "Discord", "Facebook", "Google Drive", "Google Calendar", "Twitter", "Worklenz",
    "URL", "ID", "Pro", "AppSumo Special", "Deutsch", "Español", "Português", "Shqip", "简体中文", "English"
}
UNTRANSLATED_ALLOWLIST = {
    "—", "...", "OK", "Ok", "ETC", "N/A", "UTIL", "% Used", "Total $",
    "KB", "MB", "GB", "TB", "URL", "ID", "Pro", "AppSumo Special",
    "Slack", "Microsoft Teams", "Teams", "GitHub", "LinkedIn", "Google",
    "Apple", "Excel", "YouTube", "Discord", "Facebook", "Google Drive",
    "Google Calendar", "Twitter", "Worklenz",
    "Deutsch", "Español", "Português", "Shqip", "简体中文", "English",
    "Status", "Total", "Normal", "Email", "No", "Name", "Phase", "Actions",
    "Client", "Import", "Export", "Filter", "Marketing", "Plan", "Menu",
    "Logo", "Date", "Currency", "Role", "Offline", "Online", "Overview",
    "Startup", "Startups", "Reports", "Chats", "Color", "Designer", "Bytes",
    "Roadmap", "Version", "Labels", "Mobile App", "Notifications",
    "Configuration", "System & Integrations", "Subtotal", "Estimation",
    "Optimal", "Text", "Links", "Manager", "Tickets", "Details", "Position",
    "Admin", "Cancel", "Category", "Company", "Draft", "Error", "General",
    "Info", "Parent", "Switch", "URGENT", "Weekend", "min", "Formula",
    "Single Sign-On (SSO)", "Option {n}", "Frontend, Backend, Full-stack",
    "Team", "Timer", "Service", "Message", "Messages", "Question", "Visible",
    "Dates", "Documentation", "Expression", "Construction", "Freelancer",
    "Reporter", "Upgrade", "Downgrade", "Optional", "(Optional)", "in",
    "clients", "Conversations", "phases", "Services", "page", "question",
}

def is_object(val):
    return isinstance(val, dict)

def protect_tokens(text):
    tokens = []
    def repl(m):
        tokens.append(m.group(0))
        return f"__VAR_{len(tokens)-1}__"
    pattern = r"(\{\{[^}]+\}\}|<\/?\d+>)"
    protected = re.sub(pattern, repl, text)
    return protected, tokens

def restore_tokens(text, tokens):
    for i, tok in enumerate(tokens):
        pattern = rf"__\s*VAR_{i}\s*__"
        text = re.sub(pattern, tok, text, flags=re.IGNORECASE)
    return text

def translate_batch_api(strings, target_code):
    if not strings:
        return {}
    
    results = {}
    protected_items = []
    all_tokens = []
    
    for s in strings:
        p_text, tokens = protect_tokens(s)
        protected_items.append(p_text)
        all_tokens.append(tokens)
        
    query = "\n@@@\n".join(protected_items)
    url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=" + target_code + "&dt=t&q=" + urllib.parse.quote(query)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
    
    try:
        with urllib.request.urlopen(req, timeout=12) as res:
            data = json.loads(res.read().decode("utf-8"))
            raw = "".join([part[0] for part in data[0]])
            parts = [p.strip() for p in raw.split("@@@")]
            
            if len(parts) == len(strings):
                for orig, trans_part, tokens in zip(strings, parts, all_tokens):
                    results[orig] = restore_tokens(trans_part, tokens)
            else:
                # Fallback item-by-item if split delimiter wasn't preserved
                for orig, p_item, tokens in zip(strings, protected_items, all_tokens):
                    single_url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=" + target_code + "&dt=t&q=" + urllib.parse.quote(p_item)
                    single_req = urllib.request.Request(single_url, headers={"User-Agent": "Mozilla/5.0"})
                    try:
                        with urllib.request.urlopen(single_req, timeout=8) as s_res:
                            s_data = json.loads(s_res.read().decode("utf-8"))
                            s_raw = "".join([part[0] for part in s_data[0]])
                            results[orig] = restore_tokens(s_raw, tokens)
                    except Exception:
                        results[orig] = orig
    except Exception as e:
        print(f"    [WARN] Batch request failed: {e}. Falling back individually...", flush=True)
        for orig in strings:
            results[orig] = orig
            
    return results

def build_existing_dictionary(lang):
    dict_map = {}
    source_dir = LOCALES_DIR / SOURCE_LANG
    lang_dir = LOCALES_DIR / lang
    
    for root, _, files in os.walk(source_dir):
        for f in files:
            if not f.endswith(".json"):
                continue
            source_file = Path(root) / f
            rel = source_file.relative_to(source_dir)
            lang_file = lang_dir / rel
            if not lang_file.exists():
                continue
            
            try:
                with open(source_file, "r", encoding="utf-8") as sf, open(lang_file, "r", encoding="utf-8") as lf:
                    s_data = json.load(sf)
                    l_data = json.load(lf)
                
                def extract(s_node, l_node):
                    if is_object(s_node) and is_object(l_node):
                        for k, sv in s_node.items():
                            if k in l_node:
                                extract(sv, l_node[k])
                    elif isinstance(s_node, str) and isinstance(l_node, str):
                        if s_node != l_node and s_node.strip() and l_node.strip():
                            dict_map[s_node] = l_node
                            
                extract(s_data, l_data)
            except Exception:
                continue
                
    return dict_map

def get_added_keys_per_file(lang):
    """Returns a dict mapping rel_file -> set of added key paths (or True for all keys)."""
    file_map = {}
    lang_dir = LOCALES_DIR / lang
    
    try:
        out = subprocess.check_output(
            ["git", "status", "--porcelain", f"public/locales/{lang}"],
            cwd=ROOT_DIR,
            text=True
        )
    except Exception:
        return file_map
        
    for line in out.strip().split("\n"):
        if not line:
            continue
        st = line[:2].strip()
        fpath = line[3:].strip()
        if f"public/locales/{lang}" not in fpath:
            continue
        p = ROOT_DIR / fpath[fpath.index(f"public/locales/{lang}"):]
        
        if p.is_dir():
            for sub in p.rglob("*.json"):
                rel = str(sub.relative_to(lang_dir))
                file_map[rel] = True # All keys in untracked file
        elif st == "??" and p.suffix == ".json":
            rel = str(p.relative_to(lang_dir))
            file_map[rel] = True
        elif st == "M" and p.suffix == ".json":
            rel = str(p.relative_to(lang_dir))
            try:
                head_str = subprocess.check_output(
                    ["git", "show", f"HEAD:worklenz-frontend/public/locales/{lang}/{rel}"],
                    cwd=ROOT_DIR,
                    text=True
                )
                head_data = json.loads(head_str)
                with open(p, "r", encoding="utf-8") as cur_f:
                    cur_data = json.load(cur_f)
                
                def get_flat_keys(obj, prefix=""):
                    res = set()
                    for k, v in obj.items():
                        path = f"{prefix}.{k}" if prefix else k
                        if is_object(v):
                            res.update(get_flat_keys(v, path))
                        else:
                            res.add(path)
                    return res
                
                head_keys = get_flat_keys(head_data)
                cur_keys = get_flat_keys(cur_data)
                added = cur_keys - head_keys
                if added:
                    file_map[rel] = added
            except Exception:
                file_map[rel] = True
                
    return file_map

def get_untranslated_keys_per_file(lang, namespace_filter=None):
    """Find existing locale strings that are still identical to the English source."""
    file_map = {}
    source_dir = LOCALES_DIR / SOURCE_LANG
    lang_dir = LOCALES_DIR / lang

    for source_file in source_dir.rglob("*.json"):
        rel = str(source_file.relative_to(source_dir))
        if namespace_filter and rel != namespace_filter:
            continue
        locale_file = lang_dir / rel
        if not locale_file.exists():
            continue
        try:
            with open(source_file, "r", encoding="utf-8") as sf, open(locale_file, "r", encoding="utf-8") as lf:
                source_data = json.load(sf)
                locale_data = json.load(lf)
        except Exception:
            continue

        matches = set()
        def scan(source_node, locale_node, prefix=""):
            if is_object(source_node) and is_object(locale_node):
                for key, source_value in source_node.items():
                    if key in locale_node:
                        path = f"{prefix}.{key}" if prefix else key
                        scan(source_value, locale_node[key], path)
            elif isinstance(source_node, str) and isinstance(locale_node, str):
                if (source_node == locale_node and source_node.strip() and len(source_node.strip()) > 1
                    and source_node not in UNTRANSLATED_ALLOWLIST):
                    matches.add(prefix)
        scan(source_data, locale_data)
        if matches:
            file_map[rel] = matches
    return file_map

def main():
    dry_run = "--dry-run" in sys.argv
    translate_untranslated = "--untranslated" in sys.argv
    namespace_arg = next((arg for arg in sys.argv if arg.startswith("--namespace=")), None)
    namespace_filter = namespace_arg.split("=", 1)[1] if namespace_arg else None
    print("=== Translating Untranslated Locale Keys ===", flush=True)
    if dry_run:
        print("(DRY RUN - Preview only)\n", flush=True)
        
    cache_file = ROOT_DIR / "scripts" / ".translation_cache.json"
    cache = {}
    if cache_file.exists():
        try:
            with open(cache_file, "r", encoding="utf-8") as f:
                cache = json.load(f)
        except Exception:
            cache = {}
            
    total_translated = 0
    
    for lang, cfg in LANG_CONFIG.items():
        lang_code = cfg["code"]
        lang_dir = LOCALES_DIR / lang
        print(f"\nProcessing {lang} ({cfg['name']})...", flush=True)
        
        existing_dict = build_existing_dictionary(lang)
        lang_cache = cache.setdefault(lang, {})
        added_files_map = (
            get_untranslated_keys_per_file(lang, namespace_filter)
            if translate_untranslated else get_added_keys_per_file(lang)
        )
        
        # 1. Collect all unique strings needing translation
        needed_strings = set()
        for rel, key_set in added_files_map.items():
            target_file = lang_dir / rel
            if not target_file.exists():
                continue
            with open(target_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                
            def scan(node, prefix=""):
                if is_object(node):
                    for k, v in node.items():
                        path = f"{prefix}.{k}" if prefix else k
                        scan(v, path)
                elif isinstance(node, list):
                    path = prefix
                    if key_set is True or path in key_set:
                        for item in node:
                            if isinstance(item, str) and item.strip() and item not in KEEP_AS_IS:
                                needed_strings.add(item)
                elif isinstance(node, str):
                    path = prefix
                    if (key_set is True or path in key_set) and node.strip() and node not in KEEP_AS_IS:
                        needed_strings.add(node)
                        
            scan(data)
            
        # 2. Determine which strings need API translation (exclude glossary, existing dict, cache)
        to_fetch = []
        for s in sorted(needed_strings):
            if s in KEEP_AS_IS or (s in GLOSSARY and lang in GLOSSARY[s]) or s in existing_dict or s in lang_cache:
                continue
            to_fetch.append(s)
            
        print(f"  Total untranslated strings: {len(needed_strings)} ({len(to_fetch)} new API calls needed)", flush=True)
        
        # 3. Batch fetch in chunks of 35
        BATCH_SIZE = 35
        for i in range(0, len(to_fetch), BATCH_SIZE):
            chunk = to_fetch[i : i + BATCH_SIZE]
            batch_res = translate_batch_api(chunk, lang_code)
            for k, v in batch_res.items():
                if v != k:
                    lang_cache[k] = v
            done_count = min(i + BATCH_SIZE, len(to_fetch))
            if done_count % 140 == 0 or done_count == len(to_fetch):
                print(f"    [{done_count}/{len(to_fetch)}] Translated strings cached...", flush=True)
                if not dry_run:
                    try:
                        with open(cache_file, "w", encoding="utf-8") as f:
                            json.dump(cache, f, indent=2, ensure_ascii=False)
                    except Exception:
                        pass
            time.sleep(0.05)
            
        # 4. Apply translations to target files
        translated_in_lang = 0
        for rel, key_set in added_files_map.items():
            target_file = lang_dir / rel
            if not target_file.exists():
                continue
            with open(target_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                
            file_modified = False
            
            def apply_trans(node, prefix=""):
                nonlocal file_modified, translated_in_lang
                if is_object(node):
                    new_obj = {}
                    for k, v in node.items():
                        path = f"{prefix}.{k}" if prefix else k
                        new_obj[k] = apply_trans(v, path)
                    return new_obj
                elif isinstance(node, list):
                    path = prefix
                    if key_set is True or path in key_set:
                        new_list = []
                        for item in node:
                            if isinstance(item, str) and item.strip() and item not in KEEP_AS_IS:
                                trans = resolve_translation(item, lang, existing_dict, lang_cache)
                                new_list.append(trans)
                                if trans != item:
                                    file_modified = True
                                    translated_in_lang += 1
                            else:
                                new_list.append(item)
                        return new_list
                    return node
                elif isinstance(node, str):
                    path = prefix
                    if (key_set is True or path in key_set) and node.strip() and node not in KEEP_AS_IS:
                        trans = resolve_translation(node, lang, existing_dict, lang_cache)
                        if trans != node:
                            file_modified = True
                            translated_in_lang += 1
                        return trans
                    return node
                return node
                
            def resolve_translation(text, lang_key, dict_map, l_cache):
                if text in KEEP_AS_IS:
                    return text
                if text in GLOSSARY and lang_key in GLOSSARY[text]:
                    return GLOSSARY[text][lang_key]
                if text in dict_map:
                    return dict_map[text]
                return l_cache.get(text, text)
                
            updated = apply_trans(data)
            
            if file_modified and not dry_run:
                with open(target_file, "w", encoding="utf-8") as f:
                    json.dump(updated, f, indent=2, ensure_ascii=False)
                    f.write("\n")
                    
        print(f"  ✓ Translated {translated_in_lang} keys in {len(added_files_map)} files for {lang}.", flush=True)
        total_translated += translated_in_lang
        
    if not dry_run:
        try:
            with open(cache_file, "w", encoding="utf-8") as f:
                json.dump(cache, f, indent=2, ensure_ascii=False)
        except Exception:
            pass
            
    print(f"\nSuccessfully translated {total_translated} keys across {len(LANG_CONFIG)} locales.", flush=True)

if __name__ == "__main__":
    main()
