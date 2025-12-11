#!/bin/bash

###############################################################################
# LinkedIn Authentication Tests Runner
# 
# This script runs the comprehensive test suite for LinkedIn OAuth workflow
# with detailed monitoring and reporting capabilities.
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}   LinkedIn Authentication Test Suite${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}⚠ Virtual environment not found. Creating...${NC}"
    python3 -m venv venv
    echo -e "${GREEN}✓ Virtual environment created${NC}"
fi

# Activate virtual environment
echo -e "${BLUE}▶ Activating virtual environment...${NC}"
source venv/bin/activate

# Install/update dependencies
echo -e "${BLUE}▶ Installing test dependencies...${NC}"
pip install -q --upgrade pip
pip install -q -r requirements.txt

echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

# Parse command line arguments
TEST_TYPE="all"
VERBOSE=""
MARKERS=""
SPECIFIC_TEST=""
EXPORT_REPORT=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --unit)
            TEST_TYPE="unit"
            MARKERS="-m unit"
            shift
            ;;
        --integration)
            TEST_TYPE="integration"
            MARKERS="-m integration"
            shift
            ;;
        --auth)
            MARKERS="-m auth"
            shift
            ;;
        --callback)
            MARKERS="-m callback"
            shift
            ;;
        --posting)
            MARKERS="-m posting"
            shift
            ;;
        --verbose|-v)
            VERBOSE="-vv"
            shift
            ;;
        --test)
            SPECIFIC_TEST="$2"
            shift 2
            ;;
        --export-report)
            EXPORT_REPORT="true"
            shift
            ;;
        --help|-h)
            echo "Usage: ./run_tests.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --unit              Run only unit tests"
            echo "  --integration       Run only integration tests"
            echo "  --auth              Run only authentication tests"
            echo "  --callback          Run only callback tests"
            echo "  --posting           Run only posting tests"
            echo "  --verbose, -v       Enable verbose output"
            echo "  --test <name>       Run specific test"
            echo "  --export-report     Export detailed test report to JSON"
            echo "  --help, -h          Show this help message"
            echo ""
            echo "Examples:"
            echo "  ./run_tests.sh                           # Run all tests"
            echo "  ./run_tests.sh --unit                    # Run unit tests only"
            echo "  ./run_tests.sh --integration --verbose   # Run integration tests with verbose output"
            echo "  ./run_tests.sh --test test_linkedin_callback_success_flow"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Create tests directory if it doesn't exist
mkdir -p tests/reports

# Display test configuration
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}   Test Configuration${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "Test Type:        ${GREEN}${TEST_TYPE}${NC}"
if [ -n "$MARKERS" ]; then
    echo -e "Markers:          ${GREEN}${MARKERS}${NC}"
fi
if [ -n "$SPECIFIC_TEST" ]; then
    echo -e "Specific Test:    ${GREEN}${SPECIFIC_TEST}${NC}"
fi
echo -e "Verbose:          ${GREEN}$([ -n "$VERBOSE" ] && echo "Yes" || echo "No")${NC}"
echo -e "Export Report:    ${GREEN}$([ -n "$EXPORT_REPORT" ] && echo "Yes" || echo "No")${NC}"
echo ""

# Run tests
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}   Running Tests${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Build pytest command
PYTEST_CMD="pytest $VERBOSE $MARKERS"

if [ -n "$SPECIFIC_TEST" ]; then
    PYTEST_CMD="$PYTEST_CMD -k $SPECIFIC_TEST"
fi

# Add HTML report
PYTEST_CMD="$PYTEST_CMD --html=tests/reports/test_report.html --self-contained-html"

# Run tests and capture exit code
set +e
eval $PYTEST_CMD
TEST_EXIT_CODE=$?
set -e

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}   Test Results${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed successfully!${NC}"
else
    echo -e "${RED}✗ Some tests failed (Exit code: $TEST_EXIT_CODE)${NC}"
fi

echo ""
echo -e "${BLUE}Reports Generated:${NC}"
echo -e "  • HTML Report:     ${GREEN}tests/reports/test_report.html${NC}"
echo -e "  • Coverage Report: ${GREEN}tests/coverage_report/index.html${NC}"
echo -e "  • Test Log:        ${GREEN}tests/test_execution.log${NC}"
echo -e "  • Coverage JSON:   ${GREEN}tests/coverage.json${NC}"

# Export detailed monitoring report if requested
if [ -n "$EXPORT_REPORT" ]; then
    echo ""
    echo -e "${BLUE}▶ Exporting detailed test monitoring reports...${NC}"
    
    # Create a summary report directory
    REPORT_DIR="tests/reports/monitoring_$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$REPORT_DIR"
    
    # Copy relevant logs and reports
    [ -f tests/test_execution.log ] && cp tests/test_execution.log "$REPORT_DIR/"
    [ -f tests/coverage.json ] && cp tests/coverage.json "$REPORT_DIR/"
    
    echo -e "${GREEN}✓ Monitoring reports exported to: $REPORT_DIR${NC}"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}   Quick Start Guide${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "View test results:"
echo -e "  ${YELLOW}open tests/reports/test_report.html${NC}"
echo ""
echo -e "View coverage report:"
echo -e "  ${YELLOW}open tests/coverage_report/index.html${NC}"
echo ""
echo -e "View test execution log:"
echo -e "  ${YELLOW}cat tests/test_execution.log${NC}"
echo ""
echo -e "Run specific test categories:"
echo -e "  ${YELLOW}./run_tests.sh --auth${NC}         # Authentication tests only"
echo -e "  ${YELLOW}./run_tests.sh --callback${NC}     # Callback tests only"
echo -e "  ${YELLOW}./run_tests.sh --posting${NC}      # Posting tests only"
echo ""

# Exit with test exit code
exit $TEST_EXIT_CODE
