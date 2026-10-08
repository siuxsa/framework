"""
CSHUNTER — Bug-Bounty Toolkit seed data.

FOLDERS : (id, name, sort_order)
TOOLS   : (id, name, description, command, folder_id)   — $target is substituted at run time
PIPES   : (id, name, items)   items = tool_id | [tool_id, ...]   (a nested list = parallel group)
"""

FOLDERS = [
    ("fld_subdomain", "Subdomain Enumeration",     1),
    ("fld_dns",       "DNS & Resolving",           2),
    ("fld_http",      "HTTP Probing",              3),
    ("fld_ports",     "Port Scanning",             4),
    ("fld_content",   "Content Discovery",         5),
    ("fld_urls",      "URL Collection & Crawling", 6),
    ("fld_params",    "Parameter Discovery",       7),
    ("fld_fuzz",      "Fuzzing & Injection",       8),
    ("fld_vuln",      "Vulnerability Scanning",    9),
    ("fld_js",        "JS & Secrets",             10),
    ("fld_tech",      "Tech & CMS Detection",     11),
    ("fld_screens",   "Screenshots & Visual",     12),
    ("fld_cloud",     "Cloud & Buckets",          13),
    ("fld_osint",     "OSINT & Intel",            14),
]

TOOLS = [
    # ── Subdomain Enumeration ────────────────────────────────────────────
    ("bh_subfinder",   "Subfinder",        "Passive subdomain enumeration from 30+ sources.",           "subfinder -d $target -all -recursive -silent -o subfinder_$target.txt", "fld_subdomain"),
    ("bh_assetfinder", "Assetfinder",      "Find domains and subdomains related to a target.",          "assetfinder --subs-only $target | sort -u > assetfinder_$target.txt", "fld_subdomain"),
    ("bh_amass_pass",  "Amass (Passive)",  "OWASP Amass passive DNS enumeration.",                      "amass enum -passive -d $target -o amass_passive_$target.txt", "fld_subdomain"),
    ("bh_amass_act",   "Amass (Active)",   "Amass active enumeration with brute force + resolution.",   "amass enum -active -d $target -brute -o amass_active_$target.txt", "fld_subdomain"),
    ("bh_findomain",   "Findomain",        "Fast subdomain enumerator using certificate transparency.", "findomain -t $target -u findomain_$target.txt", "fld_subdomain"),
    ("bh_sublist3r",   "Sublist3r",        "Subdomains via search engines and public sources.",         "sublist3r -d $target -o sublist3r_$target.txt", "fld_subdomain"),
    ("bh_chaos",       "Chaos",            "ProjectDiscovery Chaos public DNS dataset lookup.",         "chaos -d $target -silent -o chaos_$target.txt", "fld_subdomain"),
    ("bh_github_subs", "GitHub Subdomains","Harvest subdomains referenced across GitHub.",              "github-subdomains -d $target -o github_subs_$target.txt", "fld_subdomain"),
    ("bh_crtsh",       "crt.sh",           "Pull subdomains from Certificate Transparency logs.",       "curl -s \"https://crt.sh/?q=%25.$target&output=json\" | jq -r '.[].name_value' | sed 's/\\*\\.//g' | sort -u > crtsh_$target.txt", "fld_subdomain"),

    # ── DNS & Resolving ──────────────────────────────────────────────────
    ("bh_dnsx",        "dnsx",             "Fast multi-purpose DNS resolver & toolkit.",                "dnsx -l subs_$target.txt -resp -a -aaaa -cname -silent -o dnsx_$target.txt", "fld_dns"),
    ("bh_puredns",     "puredns",          "Resolve & brute subdomains with wildcard filtering.",       "puredns bruteforce wordlist.txt $target -r resolvers.txt -w puredns_$target.txt", "fld_dns"),
    ("bh_shuffledns",  "shuffledns",       "massdns wrapper for brute-force and resolution.",           "shuffledns -d $target -w wordlist.txt -r resolvers.txt -o shuffledns_$target.txt", "fld_dns"),
    ("bh_dnsgen",      "dnsgen",           "Generate subdomain permutations from known names.",         "cat subs_$target.txt | dnsgen - > dnsgen_$target.txt", "fld_dns"),
    ("bh_massdns",     "massdns",          "High-performance stub DNS resolver.",                       "massdns -r resolvers.txt -t A -o S -w massdns_$target.txt subs_$target.txt", "fld_dns"),
    ("bh_dnsrecon",    "DNSRecon",         "DNS enumeration and zone-transfer checks.",                 "dnsrecon -d $target -a -o dnsrecon_$target.xml", "fld_dns"),

    # ── HTTP Probing ─────────────────────────────────────────────────────
    ("bh_httpx",       "httpx",            "Probe for live hosts: title, tech, status, redirects.",     "httpx -l subs_$target.txt -td -title -status-code -tech-detect -follow-redirects -silent -o httpx_$target.txt", "fld_http"),
    ("bh_httprobe",    "httprobe",         "Probe for working HTTP and HTTPS servers.",                 "cat subs_$target.txt | httprobe -c 50 > alive_$target.txt", "fld_http"),
    ("bh_httpx_ports", "httpx (Ports)",    "Probe common web ports for live services.",                 "httpx -l subs_$target.txt -ports 80,443,8080,8443,8000,8888 -silent -o httpx_ports_$target.txt", "fld_http"),

    # ── Port Scanning ────────────────────────────────────────────────────
    ("bh_naabu",       "Naabu",            "Fast SYN/CONNECT port scanner.",                            "naabu -host $target -top-ports 1000 -silent -o naabu_$target.txt", "fld_ports"),
    ("bh_nmap",        "Nmap (Service)",   "Service/version detection with default scripts.",           "nmap -sV -sC -T4 -oN nmap_$target.txt $target", "fld_ports"),
    ("bh_nmap_full",   "Nmap (Full)",      "All-ports service scan with high rate.",                    "nmap -p- -sV -T4 --min-rate 1000 -oN nmap_full_$target.txt $target", "fld_ports"),
    ("bh_masscan",     "Masscan",          "Internet-scale asynchronous port scanner.",                 "masscan -p1-65535 $target --rate 10000 -oL masscan_$target.txt", "fld_ports"),
    ("bh_rustscan",    "RustScan",         "Ultra-fast port scanner piped into Nmap.",                  "rustscan -a $target --ulimit 5000 -- -sV -sC", "fld_ports"),

    # ── Content Discovery ────────────────────────────────────────────────
    ("bh_ffuf",        "ffuf (Dir)",       "Fast web fuzzer for directory/file discovery.",             "ffuf -u https://$target/FUZZ -w /usr/share/seclists/Discovery/Web-Content/common.txt -mc 200,204,301,302,307,401,403 -o ffuf_$target.json", "fld_content"),
    ("bh_ferox",       "Feroxbuster",      "Recursive content discovery in Rust.",                      "feroxbuster -u https://$target -w /usr/share/seclists/Discovery/Web-Content/raft-medium-directories.txt -x php,html,js,txt -o ferox_$target.txt", "fld_content"),
    ("bh_dirsearch",   "Dirsearch",        "Advanced web path brute-forcer.",                           "dirsearch -u https://$target -e php,html,js,json,txt -x 404 -o dirsearch_$target.txt", "fld_content"),
    ("bh_gobuster",    "Gobuster",         "Directory/file brute forcing.",                             "gobuster dir -u https://$target -w /usr/share/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -x php,html,txt -o gobuster_$target.txt", "fld_content"),

    # ── URL Collection & Crawling ────────────────────────────────────────
    ("bh_gau",         "gau",              "Fetch known URLs from Wayback/OTX/CommonCrawl.",            "gau $target --threads 5 > gau_$target.txt", "fld_urls"),
    ("bh_wayback",     "waybackurls",      "Fetch historical URLs from the Wayback Machine.",           "waybackurls $target > wayback_$target.txt", "fld_urls"),
    ("bh_katana",      "Katana",           "Next-generation crawling and spidering.",                   "katana -u https://$target -jc -kf all -d 3 -silent -o katana_$target.txt", "fld_urls"),
    ("bh_hakrawler",   "hakrawler",        "Fast web crawler for endpoints and assets.",                "echo https://$target | hakrawler -d 3 -subs > hakrawler_$target.txt", "fld_urls"),
    ("bh_gospider",    "GoSpider",         "Fast multi-threaded web spider.",                           "gospider -s https://$target -d 3 -c 10 -o gospider_$target", "fld_urls"),
    ("bh_waymore",     "Waymore",          "Deeper archive URL fetcher (more than gau).",               "waymore -i $target -mode U -oU waymore_$target.txt", "fld_urls"),

    # ── Parameter Discovery ──────────────────────────────────────────────
    ("bh_arjun",       "Arjun",            "HTTP parameter discovery suite.",                           "arjun -u https://$target -oT arjun_$target.txt", "fld_params"),
    ("bh_paramspider", "ParamSpider",      "Mine parameters from web archives.",                        "paramspider -d $target -o paramspider_$target.txt", "fld_params"),
    ("bh_gf_xss",      "gf (xss)",         "Extract likely XSS parameters with gf patterns.",           "cat gau_$target.txt | gf xss | sort -u > gf_xss_$target.txt", "fld_params"),

    # ── Fuzzing & Injection ──────────────────────────────────────────────
    ("bh_dalfox",      "Dalfox",           "Powerful automated XSS scanner.",                           "dalfox url https://$target -o dalfox_$target.txt", "fld_fuzz"),
    ("bh_gxss",        "Gxss",             "Check parameters for reflected values.",                    "cat urls_$target.txt | Gxss -c 100 | sort -u > gxss_$target.txt", "fld_fuzz"),
    ("bh_kxss",        "kxss",             "Find reflected and unfiltered special characters.",         "cat urls_$target.txt | kxss > kxss_$target.txt", "fld_fuzz"),
    ("bh_ffuf_param",  "ffuf (Params)",    "Fuzz GET parameter names.",                                 "ffuf -u \"https://$target/?FUZZ=test\" -w /usr/share/seclists/Discovery/Web-Content/burp-parameter-names.txt -mc all -fs 0 -o ffuf_params_$target.json", "fld_fuzz"),
    ("bh_sqlmap",      "SQLmap",           "Automatic SQL injection detection & exploitation.",         "sqlmap -u \"https://$target/?id=1\" --batch --level 3 --risk 2 --random-agent", "fld_fuzz"),

    # ── Vulnerability Scanning ───────────────────────────────────────────
    ("bh_nuclei",      "Nuclei (Host)",    "Template-based vulnerability scanner (single host).",       "nuclei -u https://$target -severity critical,high,medium -o nuclei_$target.txt", "fld_vuln"),
    ("bh_nuclei_list", "Nuclei (List)",    "Run Nuclei against a list of live hosts.",                  "nuclei -l httpx_$target.txt -t ~/nuclei-templates/ -severity critical,high -o nuclei_list_$target.txt", "fld_vuln"),
    ("bh_takeover",    "Nuclei (Takeover)","Detect subdomain takeovers with takeover templates.",       "nuclei -l httpx_$target.txt -t ~/nuclei-templates/http/takeovers/ -o takeover_$target.txt", "fld_vuln"),
    ("bh_subzy",       "Subzy",            "Subdomain takeover vulnerability checker.",                 "subzy run --targets subs_$target.txt --output subzy_$target.txt", "fld_vuln"),
    ("bh_nikto",       "Nikto",            "Web server misconfiguration & vuln scanner.",               "nikto -h https://$target -o nikto_$target.txt", "fld_vuln"),
    ("bh_wpscan",      "WPScan",           "WordPress security scanner.",                               "wpscan --url https://$target --enumerate vp,vt,u --random-user-agent", "fld_vuln"),

    # ── JS & Secrets ─────────────────────────────────────────────────────
    ("bh_subjs",       "subjs",            "Extract JavaScript file URLs from a URL list.",             "cat urls_$target.txt | subjs > jsfiles_$target.txt", "fld_js"),
    ("bh_linkfinder",  "LinkFinder",       "Discover endpoints hidden in JS files.",                    "linkfinder -i https://$target -o cli", "fld_js"),
    ("bh_secretfinder","SecretFinder",     "Find API keys and secrets inside JS.",                      "secretfinder -i https://$target -o cli", "fld_js"),
    ("bh_trufflehog",  "TruffleHog",       "Find leaked credentials in git repos/files.",              "trufflehog github --repo=https://github.com/$target", "fld_js"),
    ("bh_gitleaks",    "Gitleaks",         "Detect hardcoded secrets in source.",                       "gitleaks detect --source . -r gitleaks_$target.json", "fld_js"),

    # ── Tech & CMS Detection ─────────────────────────────────────────────
    ("bh_whatweb",     "WhatWeb",          "Web technology fingerprinting.",                            "whatweb https://$target -a 3 --log-verbose whatweb_$target.txt", "fld_tech"),
    ("bh_wappalyzer",  "Wappalyzer",       "Identify frameworks and technologies.",                     "wappalyzer https://$target", "fld_tech"),
    ("bh_cmseek",      "CMSeeK",           "CMS detection and basic exploitation.",                     "cmseek -u https://$target", "fld_tech"),

    # ── Screenshots & Visual ─────────────────────────────────────────────
    ("bh_gowitness",   "gowitness",        "Headless web screenshotting.",                              "gowitness scan single -u https://$target", "fld_screens"),
    ("bh_aquatone",    "Aquatone",         "Visual recon and clustering of HTTP sites.",                "cat alive_$target.txt | aquatone -out aquatone_$target", "fld_screens"),
    ("bh_eyewitness",  "EyeWitness",       "Screenshots plus an HTML report.",                          "eyewitness --web -f alive_$target.txt -d eyewitness_$target", "fld_screens"),

    # ── Cloud & Buckets ──────────────────────────────────────────────────
    ("bh_s3scanner",   "S3Scanner",        "Find open/misconfigured S3 buckets.",                       "s3scanner scan -f subs_$target.txt", "fld_cloud"),
    ("bh_cloud_enum",  "cloud_enum",       "Enumerate AWS/Azure/GCP public assets.",                    "cloud_enum -k $target -l cloud_enum_$target.txt", "fld_cloud"),

    # ── OSINT & Intel ────────────────────────────────────────────────────
    ("bh_harvester",   "theHarvester",     "Gather emails, hosts and names via OSINT.",                 "theHarvester -d $target -b all -f harvester_$target", "fld_osint"),
    ("bh_shodan",      "Shodan",           "Query Shodan for exposed services of a host.",              "shodan host $target", "fld_osint"),
]

PIPES = [
    ("pipe_full_recon",  "Full Recon",
        [["bh_subfinder", "bh_assetfinder", "bh_findomain"], "bh_dnsx", "bh_httpx", "bh_naabu", "bh_nuclei_list"]),
    ("pipe_subdomain",   "Subdomain Enumeration",
        [["bh_subfinder", "bh_assetfinder", "bh_amass_pass", "bh_findomain"], "bh_dnsx", "bh_httpx"]),
    ("pipe_takeover",    "Subdomain Takeover Hunt",
        ["bh_subfinder", "bh_httpx", "bh_subzy", "bh_takeover"]),
    ("pipe_content",     "Content Discovery",
        ["bh_httpx", ["bh_gau", "bh_wayback", "bh_katana"], "bh_ffuf"]),
    ("pipe_vuln",        "Quick Vulnerability Scan",
        ["bh_httpx", "bh_nuclei", "bh_nikto"]),
    ("pipe_urls_params", "URL & Parameter Mining",
        [["bh_gau", "bh_wayback"], "bh_arjun", "bh_dalfox"]),
]
