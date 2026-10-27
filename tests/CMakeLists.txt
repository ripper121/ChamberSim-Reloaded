add_executable(tst_core tst_core.cpp)
target_link_libraries(tst_core PRIVATE csrcore Qt6::Test)
target_compile_definitions(tst_core PRIVATE
    CSR_SOURCE_DIR="${CMAKE_SOURCE_DIR}"
    CSR_FIXTURE_DIR="${CMAKE_CURRENT_SOURCE_DIR}/fixtures")
add_test(NAME core COMMAND tst_core)

add_executable(tst_gui tst_gui.cpp)
target_link_libraries(tst_gui PRIVATE csrui Qt6::Test)
target_compile_definitions(tst_gui PRIVATE CSR_SOURCE_DIR="${CMAKE_SOURCE_DIR}"
    CSR_FIXTURE_DIR="${CMAKE_CURRENT_SOURCE_DIR}/fixtures"
    CSR_QM_DIR="${CMAKE_BINARY_DIR}")  # the .qm files (embedded only into the program): the English plural forms
add_dependencies(tst_gui release_translations)
add_test(NAME gui COMMAND tst_gui)
if(WIN32)
    # The static MSYS2 Qt build ships only the Windows platform plugin; forcing the optional offscreen plugin aborts before the suite starts.
    set_tests_properties(gui PROPERTIES ENVIRONMENT "QT_QPA_PLATFORM=windows")
else()
    set_tests_properties(gui PROPERTIES ENVIRONMENT "QT_QPA_PLATFORM=offscreen")
endif()

# the project's record files must all be usable
add_test(NAME projectdata COMMAND csr_datacheck "${CMAKE_SOURCE_DIR}/data")

# headless simulation
add_test(NAME sim_cli COMMAND csr_sim --format json "${CMAKE_CURRENT_SOURCE_DIR}/fixtures/8x57is.grtload")
set_tests_properties(sim_cli PROPERTIES PASS_REGULAR_EXPRESSION "muzzleVelocity_ms")
add_test(NAME sim_cli_missing_file COMMAND csr_sim "${CMAKE_CURRENT_SOURCE_DIR}/fixtures/does-not-exist.grtload")
set_tests_properties(sim_cli_missing_file PROPERTIES WILL_FAIL TRUE)

# Physical powder fitting must use the same embedded caliber factors as the GUI and csr_sim.
add_test(NAME fitpowder_cli_physical COMMAND csr_fitpowder --model physical --params Ba "${CMAKE_CURRENT_SOURCE_DIR}/fixtures/measurements.grtload")
set_tests_properties(fitpowder_cli_physical PROPERTIES PASS_REGULAR_EXPRESSION "687\\.5")

if(TARGET clang_format)
    add_dependencies(tst_core clang_format)
    add_dependencies(tst_gui clang_format)
endif()
