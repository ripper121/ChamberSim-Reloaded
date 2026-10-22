import { describe, expect, it } from "vitest";
import {
  defaultReportTemplate, expandReportPragmas, formatReportNumber, renderReport, reportFraction, reportImage, reportNumber,
  reportText, reportUnitForSystem, setReportValue, wikiToHtml, type ReportData
} from "./report";

describe("native report number formats", () => {
  it.each([
    [51.78, "#.000", "51.780"], [51.78, "#.000 mm²", "51.780 mm²"], [2.5, "0", "3"], [-2.5, "0", "-3"],
    [0.005, "0.00", "0.01"], [1.5, "#.##", "1.5"], [2, "#.##", "2"], [2, "0.00", "2.00"], [2.5, "0.0#", "2.5"],
    [2.125, "0.0#", "2.13"], [3.14, "00.0", "03.1"], [0.5, "#.00", ".50"], [0.5, "0.00", "0.50"],
    [0, "0.00", "0.00"], [-0.001, "0.00", "0.00"], [1234567.891, "#,##0.00", "1,234,567.89"],
    [12, "#,##0", "12"], [0.7104, "0.0%", "71.0%"], [0.5, "0 %", "50 %"], [2, "(0.0)", "(2.0)"],
    [3, "+0.0", "+3.0"], [-3, "+0.0", "-3.0"], [-3, "-0.0", "-3.0"], [3, "-0.0", "3.0"],
    [-3.25, "0.00", "-3.25"], [-2, "(0.0)", "(-2.0)"], [12345, "0.00E+00", "1.23E+04"],
    [0.00123, "0.00E+00", "1.23E-03"], [12345, "0.0E00", "1.2E04"], [9.999, "0.00E+00", "1.00E+01"],
    [0, "0.0E+00", "0.0E+00"], [-1500, "0.0E+00", "-1.5E+03"], [4, " bar", " bar4"], [1.25, "", "1.25"]
  ])("formats %s with %s", (value, format, expected) => expect(formatReportNumber(value, format)).toBe(expected));

  it("formats non-finite values exactly", () => {
    expect(formatReportNumber(Number.NaN, "0")).toBe("NaN");
    expect(formatReportNumber(Infinity, "0")).toBe("INF");
    expect(formatReportNumber(-Infinity, "0")).toBe("-INF");
  });
});

describe("native report wiki markup", () => {
  it("renders headings, inline styles, paragraphs and typography", () => {
    expect(wikiToHtml("====== A ======")).toContain("<h1>A</h1>");
    expect(wikiToHtml("===== B =====")).toContain("<h2>B</h2>");
    expect(wikiToHtml("==== C ====")).toContain("<h3>C</h3>");
    expect(wikiToHtml("== E ==")).toContain("<h5>E</h5>");
    const styled = wikiToHtml("**a** //b// __c__ ''d''");
    expect(styled).toContain("<b>a</b>"); expect(styled).toContain("<i>b</i>");
    expect(styled).toContain("<u>c</u>"); expect(styled).toContain("<tt>d</tt>");
    expect(wikiToHtml("**__//x//__**")).toMatch(/<b>.*<u>.*<i>x<\/i>.*<\/u>.*<\/b>/);
    expect(wikiToHtml("one\n\ntwo").match(/<p>/g)).toHaveLength(2);
    expect(wikiToHtml("line1\\\\ line2")).toContain("<br>");
    expect(wikiToHtml("line1\nline2")).not.toContain("<br>");
    const typography = wikiToHtml("a -> b => c (c) (tm) -- d");
    for (const text of ["→", "⇒", "©", "™", "–"]) expect(typography).toContain(text);
    expect(wikiToHtml("see http://example.org/x")).toContain("http://example.org/x");
  });

  it("renders blocks, lists, tables and page breaks", () => {
    expect(wikiToHtml("text\n\n----\n\nmore")).toContain("<hr>");
    const list = wikiToHtml("  * a\n  * b\n    * c\n  * d");
    expect(list.match(/<ul>/g)).toHaveLength(2); expect(list.match(/<\/ul>/g)).toHaveLength(2); expect(list.match(/<li>/g)).toHaveLength(4);
    const code = wikiToHtml("<code>\n  * not a list\n**not bold**\n</code>");
    expect(code).toContain("<pre>"); expect(code).toContain("* not a list"); expect(code).not.toContain("<ul>"); expect(code).not.toContain("<b>");
    expect(wikiToHtml("<code>x = 1</code>")).toContain("<pre>x = 1</pre>");
    const table = wikiToHtml("^ H1 ^ H2 ^\n| a | b |\n| c | d |");
    expect(table.match(/<table/g)).toHaveLength(1); expect(table).toContain("<th>H1</th>"); expect(table).toContain("<td>d</td>");
    expect(table.match(/<tr>/g)).toHaveLength(3);
    expect(wikiToHtml("| x | y ||\n| 1 | 2 | 3 |")).toContain('colspan="2"');
    const vertical = wikiToHtml("|   ^ Head ^\n^ Side | cell |");
    expect(vertical).toContain("<th>Head</th>"); expect(vertical).toContain("<th>Side</th>"); expect(vertical).toContain("<td>cell</td>");
    expect(wikiToHtml("before\n\n<pagebreak>\n\nafter")).toMatch(/before.*page-break-before.*after/s);
    expect(wikiToHtml("use <pagebreak> here")).toContain("&lt;pagebreak&gt;");
  });

  it("renders native image sizes, links, colors and sizes", () => {
    const data: ReportData = new Map();
    setReportValue(data, "known.png", reportImage("data:image/png;base64,AAA", 400, 200));
    expect(wikiToHtml("{{known.png}}", data, 1000)).toContain('<img src="data:image/png;base64,AAA" width="400" height="200">');
    expect(wikiToHtml("{{known.png?80}}", data, 1000)).toContain('width="80" height="40"');
    expect(wikiToHtml("{{known.png?15%}}", data, 1000)).toContain('width="150" height="75"');
    expect(wikiToHtml("{{known.png?100%}}", data, 600)).toContain('width="600" height="300"');
    expect(wikiToHtml("{{known.png?100x50}}", data, 1000)).toContain('width="100" height="50"');
    expect(wikiToHtml("{{known.png?900}}", data, 300)).toContain('width="300" height="150"');
    expect(wikiToHtml("{{known.png?100  }}", data, 1000)).toContain('align="left"');
    expect(wikiToHtml("{{  known.png?100}}", data, 1000)).toContain('align="right"');
    expect(wikiToHtml("{{known.png?100&link=https://example.org}}", data)).toContain('<a href="https://example.org">');
    expect(wikiToHtml("{{missing.png}}", data)).toContain("[missing.png]");
    expect(wikiToHtml("[[http://x.org|Site]]")).toContain('<a href="http://x.org">Site</a>');
    expect(wikiToHtml("[[me@example.org]]")).toContain("mailto:me@example.org");
    expect(wikiToHtml("<color red>x</color>")).toContain('<span style="color:#e02020">x</span>');
    expect(wikiToHtml("<color #80ff80>x</color>")).toContain("color:#80ff80");
    expect(wikiToHtml("<size 150%>x</size>")).toContain("font-size:15pt");
    expect(wikiToHtml("<size=14>x</size>")).toContain("font-size:14pt");
  });

  it("escapes hostile template content", () => {
    const hostile = wikiToHtml("<script>alert(1)</script> & <img src=x onerror=y> **ok**");
    expect(hostile).not.toContain("<script>"); expect(hostile).not.toContain("<img");
    expect(hostile).toContain("&lt;script&gt;"); expect(hostile).toContain("&amp;"); expect(hostile).toContain("<b>ok</b>");
    expect(wikiToHtml('[[x" onclick="y|t]]')).not.toContain('onclick="y');
  });
});

describe("native report placeholders", () => {
  const data = (): ReportData => {
    const values: ReportData = new Map();
    setReportValue(values, "work.Aeff", reportNumber(51.78, "area"));
    setReportValue(values, "work.CaliberName", reportText("8 x 57 IS"));
    setReportValue(values, "result.LoadRatio", reportFraction(0.7104));
    setReportValue(values, "work.k", reportNumber(1.2214));
    setReportValue(values, "work.half", reportNumber(0.5));
    setReportValue(values, "result.diagramm.png", reportImage("data:image/png;base64,AAA", 800, 400));
    return values;
  };

  it("expands text, numbers, images and missing values", () => {
    const values = data();
    expect(expandReportPragmas("~~work.CaliberName~~", values)).toBe("8 x 57 IS");
    expect(expandReportPragmas("~~WORK.caliberNAME~~", values)).toBe("8 x 57 IS");
    expect(expandReportPragmas('~~ work.Aeff ( "0.0" ) ~~', values)).toBe("51.8");
    expect(expandReportPragmas('~~work.Aeff("#.000 mm²")~~', values)).toBe("51.780 mm²");
    expect(expandReportPragmas("~~result.LoadRatio~~", values)).toBe("71.0 %");
    expect(expandReportPragmas('~~result.LoadRatio("0.00")~~', values)).toBe("0.71");
    expect(expandReportPragmas("~~work.k~~", values)).toBe("1.2214");
    expect(expandReportPragmas("~~work.half~~", values)).toBe("0.5");
    expect(expandReportPragmas('~~result.diagramm.png("?40%")~~', values)).toBe("{{result.diagramm.png?40%}}");
    expect(expandReportPragmas("~~work.nothing~~", values)).toBe("<color red>[work.nothing?]</color>");
    const html = renderReport("~~work.CaliberName~~ {{result.diagramm.png}} ~~work.nothing~~", values);
    expect(html).toContain("8 x 57 IS"); expect(html).toContain("data:image/png;base64,AAA"); expect(html).toContain("color:#e02020");
  });

  it("applies automatic units but keeps explicit formats in base units", () => {
    const values: ReportData = new Map();
    setReportValue(values, "result.MaxPressure", reportNumber(2287, "pressure"));
    setReportValue(values, "work.mp", reportNumber(12.7005863599, "bulletMass"));
    setReportValue(values, "work.pt", reportNumber(21, "temperature"));
    expect(expandReportPragmas("~~result.MaxPressure~~", values)).toBe("2287 bar");
    const options = { unitFor: reportUnitForSystem("imperial") };
    expect(expandReportPragmas("~~result.MaxPressure~~", values, options)).toBe("33170 psi");
    expect(expandReportPragmas("~~work.mp~~", values, options)).toBe("196.00 grain");
    expect(expandReportPragmas("~~work.pt~~", values, options)).toBe("70 °F");
    expect(expandReportPragmas('~~result.MaxPressure("0 bar")~~', values, options)).toBe("2287 bar");
  });

  it("contains the complete native default report contract", () => {
    for (const marker of ["~~file.caption~~", "===== Input data =====", "===== Results =====", "<pagebreak>",
      "result.diagramCurves.png", "caliber.drawing.png", "measurement.section", "Use at your own risk", "~~app.version~~"])
      expect(defaultReportTemplate).toContain(marker);
  });
});
