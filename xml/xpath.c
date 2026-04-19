
XPath 스타일 (가장 일반적):

/root/child/grandchild - 절대 경로
//element - 문서 내 모든 element 검색
/root/child[@id='1'] - 속성 조건
/root/child[1] - 인덱스 (1-based)

I've updated index.html to use XPath-style DOM path expression rules.

Changes made:

XPath-based XML Structure Analysis - The generateCppCode() function now:

Builds XPath expressions for each element in the XML tree
Shows absolute paths like /root/child/grandchild
Handles duplicate sibling elements with index notation: /root/element[1], /root/element[2]
Displays attribute paths: /root/element/@attributeName
Shows element text content
Output format example:

// XPath: /root
// Element: root
// Attributes:
//   @id = "1"
//   XPath: /root/@id

// XPath: /root/child
// Element: child

Helper functions implemented:

getCppType() - Infers C++ type from value (bool, int, double, std::string)
capitalizeFirstLetter() - Converts element names to C++ class name format
XPath DOM Path Rules:

Absolute path: /root/child/grandchild
With attribute: /root/element[@id='1'] (shown as /root/element/@id for attribute paths)
With index: /root/element[1] (when multiple siblings have the same tag name)