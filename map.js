// 當文件加載完成後再初始化地圖
document.addEventListener('DOMContentLoaded', function() {
    console.log('開始初始化地圖...');
    
    // 定義 Excel 檔案路徑
    const xlsxPath = '教育訓練單位總表.xlsx';
    console.log('Excel檔案路徑:', xlsxPath);
    
    // 初始化地圖，設置中心點在台灣中心位置
    const map = L.map('map').setView([23.5, 121], 8);

    // 添加OpenStreetMap圖層
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // 從經緯度字串取得座標
    function getCoordinatesFromString(coordString) {
        if (!coordString) {
            console.log('經緯度字串為空');
            return null;
        }
        try {
            // 移除所有引號和多餘的空格
            const cleanString = coordString.replace(/["']/g, '').trim();
            
            // 檢查是否包含經度和緯度
            if (!cleanString.includes(',')) {
                console.log('經緯度字串格式錯誤，缺少逗號分隔符');
                return null;
            }

            // 分割並解析座標
            const parts = cleanString.split(',');
            const lat = parseFloat(parts[0].trim());
            const lng = parseFloat(parts[1].trim());
            
            if (!isNaN(lat) && !isNaN(lng)) {
                return [lat, lng];
            }
            console.log('無效的座標值');
            return null;
        } catch (error) {
            console.error('解析經緯度時發生錯誤:', error);
            return null;
        }
    }

    // 格式化系統帳號
    function formatAccountNumber(account) {
        if (!account) return '無';
        
        try {
            let numStr = String(account).trim();
            
            // 种去非數字字元
            numStr = numStr.replace(/[^\d]/g, '');
            
            if (!numStr) return '無';
            
            // 確保12位數
            if (numStr.length > 12) {
                numStr = numStr.slice(0, 12);
            }
            while (numStr.length < 12) {
                numStr = '0' + numStr;
            }
            
            return numStr;
        } catch (error) {
            console.error('格式化系統帳號時發生錯誤:', error, '原始值:', account);
            return '無法顯示';
        }
    }

    // 建立標記群組，調整群集設定
    const markers = L.markerClusterGroup({
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: true,
        zoomToBoundsOnClick: true,
        spiderfyDistanceMultiplier: 1.5,  // 增加展開時的距離
        animate: false  // 關閉動畫以提高穩定性
    });

    let institutionsData = [];
    let filteredData = [];
    let markerReferences = []; // 定義全域陣列來儲存標記引用

    // 獲取所有選擇器元素
    const searchInput = document.getElementById('search-input');
    const categorySelect = document.getElementById('category-select');
    const agencySelect = document.getElementById('agency-select');
    const managementSelect = document.getElementById('management-select');
    const technicalSelect = document.getElementById('technical-select');
    const institutionListElement = document.getElementById('institution-list');
    let activeListItem = null;
    
    // 添加搜尋輸入框的事件監聽器
    searchInput.addEventListener('input', () => {
        updateFilters();
    });

    let currentFilter = '';
    let currentCategories = [];
    let currentAgencies = [];
    let currentManagements = [];
    let currentTechnicals = [];
    
    // 更新篩選器
    function updateFilters() {
        currentFilter = searchInput.value.trim().toLowerCase();
        
        // 獲取多選值
        currentCategories = Array.from(categorySelect.selectedOptions).map(option => option.value).filter(val => val !== '');
        currentAgencies = Array.from(agencySelect.selectedOptions).map(option => option.value).filter(val => val !== '');
        currentManagements = Array.from(managementSelect.selectedOptions).map(option => option.value).filter(val => val !== '');
        currentTechnicals = Array.from(technicalSelect.selectedOptions).map(option => option.value).filter(val => val !== '');
        
        console.log('更新篩選條件:', {
            search: currentFilter,
            categories: currentCategories,
            agencies: currentAgencies,
            managements: currentManagements,
            technicals: currentTechnicals
        });
        
        filterData();
        displayMarkers();
        updateInstitutionList();
    }

    // 列表項目點擊處理函數
    function handleItemClick(item, index, listItem) {
        const coordinates = getCoordinatesFromString(item.地址經緯度);
        if (coordinates) {
            if (activeListItem) {
                activeListItem.classList.remove('active');
            }
            
            listItem.classList.add('active');
            activeListItem = listItem;

            const targetMarker = markerReferences[index];
            if (targetMarker) {
                // 關閉其他已開啟的彈出視窗
                markers.eachLayer((layer) => {
                    if (layer !== targetMarker && layer.isPopupOpen()) {
                        layer.closePopup();
                    }
                });

                // 設定地圖視圖
                map.setView(coordinates, 15);

                // 確保標記點可見並開啟彈出視窗
                setTimeout(() => {
                    targetMarker.openPopup();
                }, 100);
            }

            listItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    // 更新機構列表
    function updateInstitutionList() {
        institutionListElement.innerHTML = '';
        const filteredLength = filteredData.length;
        
        const listCount = document.getElementById('list-count');
        if (listCount) {
            listCount.textContent = `共 ${filteredLength} 筆結果`;
        }
        
        filteredData.forEach((item, index) => {
            const listItem = document.createElement('li');
            listItem.className = 'institution-item';
            
            const content = `
                <div class="institution-number">#${index + 1}</div>
                <div class="institution-info">
                    <div class="institution-name">${item.職訓機構名稱}</div>
                    <div class="institution-details">
                        ${item.類別} | ${item.管理 || '無'} | ${item.技術 || '無'}
                    </div>
                </div>
            `;
            
            listItem.innerHTML = content;
            
            // 使用統一的點擊處理函數
            listItem.addEventListener('click', () => {
                handleItemClick(item, index, listItem);
            });
            
            institutionListElement.appendChild(listItem);
        });
    }

    // 過濾資料函數
    function filterData() {
        try {
            filteredData = institutionsData.filter(item => {
                // 根據類別過濾（支援多選）
                const matchCategory = currentCategories.length === 0 || currentCategories.includes(item.類別);

                // 根據管理等級過濾（支援多選）
                const matchManagement = currentManagements.length === 0 || currentManagements.includes(item.管理);

                // 根據技術等級過濾（支援多選）
                const matchTechnical = currentTechnicals.length === 0 || currentTechnicals.includes(item.技術);
                
                // 根據主管機關過濾（支援多選）
                const matchAgency = currentAgencies.length === 0 || currentAgencies.includes(item.主管機關);

                // 根據搜尋關鍵字過濾
                let matchSearch = true;
                if (currentFilter) {
                    matchSearch = (
                        (item.職訓機構名稱 && item.職訓機構名稱.toLowerCase().includes(currentFilter)) ||
                        (item.地址 && item.地址.toLowerCase().includes(currentFilter)) ||
                        (item.類別 && item.類別.toLowerCase().includes(currentFilter)) ||
                        (item.主管機關 && item.主管機關.toLowerCase().includes(currentFilter))
                    );
                }

                return matchCategory && matchManagement && matchTechnical && matchAgency && matchSearch;
            });

            // 更新結果計數
            const listCount = document.getElementById('list-count');
            if (listCount) {
                listCount.textContent = `共 ${filteredData.length} 筆結果`;
            }

        } catch (error) {
            console.error('過濾資料時發生錯誤:', error);
        }
    }

    // 顯示標記
    function displayMarkers() {
        console.log('開始顯示標記點...');
        
        // 清除現有標記
        markers.clearLayers();
        
        // 設置標記點樣式
        const defaultIcon = L.divIcon({
            className: 'custom-marker',
            html: '<div class="marker-icon"></div>',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });

        let validMarkersCount = 0;
        const bounds = L.latLngBounds();

        // 為當前頁的資料添加標記
        filteredData.forEach((item, index) => {
            const coordinates = getCoordinatesFromString(item.地址經緯度);
            if (coordinates) {
                validMarkersCount++;
                
                const marker = L.marker(coordinates, { icon: defaultIcon });
                markerReferences[index] = marker;
                
                // 設置標記點的層級
                marker.setZIndexOffset(1000);
                
                // 標記點彈出資訊
                const popupContent = `
                    <div class="popup-content">
                        <h3>${item.職訓機構名稱}</h3>
                        <table class="info-table">
                            <tr>
                                <td>類別：</td>
                                <td>${item.類別 || '無'}</td>
                            </tr>
                            <tr>
                                <td>系統帳號：</td>
                                <td>${formatAccountNumber(item.系統帳號)}</td>
                            </tr>
                            <tr>
                                <td>管理等級：</td>
                                <td>${item.管理 || '無'}</td>
                            </tr>
                            <tr>
                                <td>技術等級：</td>
                                <td>${item.技術 || '無'}</td>
                            </tr>
                            <tr>
                                <td>主管機關：</td>
                                <td>${item.主管機關 || '無'}</td>
                            </tr>
                            <tr>
                                <td>負責人：</td>
                                <td>${item.負責人職稱 || ''} ${item.負責人 || '無'}</td>
                            </tr>
                            <tr>
                                <td>電話：</td>
                                <td>${item.電話 || '無'}</td>
                            </tr>
                            <tr>
                                <td>信箱：</td>
                                <td>${item.信箱 || '無'}</td>
                            </tr>
                            <tr>
                                <td>地址：</td>
                                <td>${item.地址 || '無'}</td>
                            </tr>
                        </table>
                    </div>
                `;
                
                // 創建彈出視窗
                const popup = L.popup({
                    className: 'custom-popup',
                    maxWidth: 300,
                    autoPan: true,
                    closeButton: true,
                    autoClose: false,
                    closeOnClick: false,
                    closeOnEscapeKey: true
                }).setContent(popupContent);

                // 綁定彈出視窗到標記點
                marker.bindPopup(popup);

                // 當標記被點擊時
                marker.on('click', () => {
                    // 關閉其他已開啟的彈出視窗
                    markers.eachLayer((layer) => {
                        if (layer !== marker && layer.isPopupOpen()) {
                            layer.closePopup();
                        }
                    });

                    // 找到對應的列表項目並設置活動狀態
                    const listItems = institutionListElement.getElementsByClassName('institution-item');
                    if (listItems[index]) {
                        // 移除之前列表項目的活動狀態
                        if (activeListItem) {
                            activeListItem.classList.remove('active');
                        }
                        
                        listItems[index].classList.add('active');
                        activeListItem = listItems[index];
                        listItems[index].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                });
                
                markers.addLayer(marker);
                bounds.extend(coordinates);
            }
        });

        console.log('有效標記點數量:', validMarkersCount);

        // 將標記群組添加到地圖
        map.addLayer(markers);

        // 調整地圖視圖以顯示所有標記
        if (validMarkersCount > 0) {
            console.log('調整地圖視圖到標記範圍');
            map.fitBounds(bounds.pad(0.1));
        } else {
            console.log('無有效標記點，顯示預設視圖');
            map.setView([23.5, 121], 8);
        }

        // 更新機構列表
        updateInstitutionList();
    }

    const downloadButton = document.getElementById('download-button');
    
    // 添加下載按鈕點擊事件
    downloadButton.addEventListener('click', () => {
        downloadFilteredData();
    });

    // 下載篩選後的資料
    function downloadFilteredData() {
        // 準備 Excel 工作表資料
        const headers = ['序', '類別', '系統帳號', '單一職訓機構', '職訓機構名稱', '管理', '技術',
                        '主管機關', '負責人職稱', '負責人', '電話', '信箱', '地址', '地址經緯度'];
        
        // 使用目前過濾後的資料順序，並重新編排序號
        const formattedData = filteredData.map((item, index) => [
            (index + 1).toString(), // 重新編排序號，從1開始
            item.類別,
            { v: formatAccountNumber(item.系統帳號), t: 's' },
            item.單一職訓機構,
            item.職訓機構名稱,
            item.管理,
            item.技術,
            item.主管機關,
            item.負責人職稱,
            item.負責人,
            item.電話,
            item.信箱,
            item.地址,
            item.地址經緯度
        ]);
        
        const data = [
            headers,
            ...formattedData
        ];
        
        // 創建工作表
        const ws = XLSX.utils.aoa_to_sheet(data);
        
        // 設定系統帳號欄位的格式為文字
        const range = XLSX.utils.decode_range(ws['!ref']);
        for(let R = 1; R <= range.e.r; ++R) {
            const cell_address = XLSX.utils.encode_cell({r: R, c: 2}); // 系統帳號是第三欄 (索引 2)
            if(!ws[cell_address]) continue;
            
            // 確保系統帳號欄位使用文字格式
            ws[cell_address].t = 's';
            ws[cell_address].z = '@';
            
            // 強制將值轉換為字串格式
            if (ws[cell_address].v && typeof ws[cell_address].v === 'object') {
                ws[cell_address].v = ws[cell_address].v.v;
            }
        }
        
        // 創建工作簿並添加工作表
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '職訓機構列表');
        
        // 設定檔案名稱
        const date = new Date().toLocaleDateString('zh-TW', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).replace(/\//g, '');
        
        // 下載檔案
        XLSX.writeFile(wb, `職訓機構列表_${date}.xlsx`);
    }

    // 初始化選擇器時的處理函數
    function initializeSelect(selectElement, options, title) {
        selectElement.innerHTML = '';
        
        // 添加全選選項
        const allOption = document.createElement('option');
        allOption.value = '';
        allOption.textContent = `所有${title}`;
        allOption.selected = true;
        selectElement.appendChild(allOption);
        
        // 添加選項
        options.forEach(option => {
            if (option) {
                const optionElement = document.createElement('option');
                optionElement.value = option;
                optionElement.textContent = option;
                selectElement.appendChild(optionElement);
            }
        });
        
        // 更新選擇器標題
        updateSelectTitle(selectElement, title);
        
        // 添加變更事件監聽器
        selectElement.addEventListener('change', (event) => {
            const selectedOptions = Array.from(selectElement.selectedOptions);
            const allOptionSelected = selectedOptions.some(opt => opt.value === '');
            const otherOptionsSelected = selectedOptions.some(opt => opt.value !== '');

            // 如果選擇了非「所有」的選項，取消「所有」選項
            if (otherOptionsSelected && allOptionSelected) {
                allOption.selected = false;
            }
            
            // 如果選擇了「所有」選項，取消其他所有選項
            if (allOptionSelected) {
                Array.from(selectElement.options).forEach(opt => {
                    if (opt.value !== '') {
                        opt.selected = false;
                    }
                });
            }

            // 如果沒有選擇任何選項，自動選擇「所有」選項
            if (Array.from(selectElement.selectedOptions).length === 0) {
                allOption.selected = true;
            }

            updateSelectTitle(selectElement, title);
            updateFilters();
        });
    }

    // 更新選擇器標題
    function updateSelectTitle(selectElement, title) {
        const selectedOptions = Array.from(selectElement.selectedOptions);
        const selectedCount = selectedOptions.filter(option => option.value !== '').length;
        
        if (selectedOptions.some(opt => opt.value === '')) {
            selectElement.title = `所有${title}`;
        } else if (selectedCount > 0) {
            selectElement.title = `已選擇 ${selectedCount} 個${title}`;
        } else {
            selectElement.title = `選擇${title}`;
        }
    }

    // 更新 Excel 資料處理函數
    function processExcelData(jsonData) {
        console.log('開始處理Excel資料...');
        try {
            // 定義主管機關順序
            const orderedAgencies = [
                '基隆市政府', '臺北市政府', '新北市政府', '桃園市政府', 
                '新竹市政府', '新竹縣政府', '苗栗縣政府', '臺中市政府', 
                '彰化縣政府', '南投縣政府', '雲林縣政府', '嘉義市政府', 
                '嘉義縣政府', '臺南市政府', '高雄市政府', '屏東縣政府',
                '宜蘭縣政府', '花蓮縣政府', '臺東縣政府', '澎湖縣政府',
                '金門縣政府', '連江縣政府'
            ];

            const agencyOrder = {};
            orderedAgencies.forEach((agency, index) => {
                agencyOrder[agency] = index + 1;
            });

            // 轉換JSON資料為所需格式並排序
            institutionsData = jsonData
                .map((row, index) => {
                    return {
                        序: row.序,
                        類別: row.類別,
                        系統帳號: row.系統帳號,
                        單一職訓機構: row.單一職訓機構,
                        職訓機構名稱: row.職訓機構名稱,
                        管理: row.管理,
                        技術: row.技術,
                        主管機關: row.主管機關,
                        負責人職稱: row.負責人職稱,
                        負責人: row.負責人,
                        電話: row.電話,
                        信箱: row.信箱,
                        地址: row.地址,
                        地址經緯度: row.地址經緯度
                    };
                })
                .filter(item => {
                    const isValid = item.職訓機構名稱 && item.地址經緯度;
                    if (!isValid) {
                        console.log('發現無效資料:', item);
                    }
                    return isValid;
                })
                .sort((a, b) => {
                    const orderA = agencyOrder[a.主管機關] || 999;
                    const orderB = agencyOrder[b.主管機關] || 999;
                    return orderA - orderB;
                });

            console.log('成功解析資料筆數:', institutionsData.length);
            if (institutionsData.length > 0) {
                console.log('第一筆資料樣本:', institutionsData[0]);
            }

            // 定義等級的順序
            const levelOrder = ['優等', '甲等', '乙等', '丙等', '丁等', '無', '乙等(僅檔案紀錄)'];
            
            // 使用新的初始化函數
            console.log('開始初始化選擇器...');

            const categories = [...new Set(institutionsData.map(item => item.類別))].filter(category => category);
            console.log('找到的類別:', categories);
            initializeSelect(categorySelect, categories, '類別');

            const uniqueManagementLevels = [...new Set(institutionsData.map(item => item.管理))].filter(level => level);
            console.log('找到的管理等級:', uniqueManagementLevels);
            initializeSelect(managementSelect, levelOrder.filter(level => uniqueManagementLevels.includes(level)), '管理等級');

            const uniqueTechnicalLevels = [...new Set(institutionsData.map(item => item.技術))].filter(level => level);
            console.log('找到的技術等級:', uniqueTechnicalLevels);
            initializeSelect(technicalSelect, levelOrder.filter(level => uniqueTechnicalLevels.includes(level)), '技術等級');

            // 主管機關選擇器初始化
            const uniqueAgencies = [...new Set(institutionsData.map(item => item.主管機關))].filter(agency => agency);
            console.log('找到的主管機關:', uniqueAgencies);
            
            // 依照順序排列主管機關
            const orderedUniqueAgencies = orderedAgencies.filter(agency => uniqueAgencies.includes(agency));
            
            // 加入其他未在預設順序中的主管機關
            uniqueAgencies.forEach(agency => {
                if (!orderedUniqueAgencies.includes(agency)) {
                    orderedUniqueAgencies.push(agency);
                }
            });
            
            console.log('排序後的主管機關:', orderedUniqueAgencies);
            initializeSelect(agencySelect, orderedUniqueAgencies, '主管機關');

            // 顯示所有資料
            console.log('開始顯示資料...');
            filterData();
            displayMarkers();
            updateInstitutionList();

        } catch (error) {
            console.error('處理Excel資料時發生錯誤:', error);
            // 確保錯誤訊息顯示在正確的位置
            const listCount = document.getElementById('list-count');
            if (listCount) {
                listCount.textContent = '處理資料時發生錯誤';
            }
        }
    }

    // Excel 檔案讀取錯誤處理
    fetch(xlsxPath)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            console.log('成功獲取檔案回應');
            return response.arrayBuffer();
        })
        .then(buffer => {
            console.log('開始解析Excel檔案...');
            const data = new Uint8Array(buffer);
            const workbook = XLSX.read(data, { type: 'array' });
            
            console.log('工作表清單:', workbook.SheetNames);
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            // 將工作表轉換為 JSON 格式
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
                header: ['序', '類別', '系統帳號', '單一職訓機構', '職訓機構名稱', 
                        '管理', '技術', '主管機關', '負責人職稱', '負責人',
                        '電話', '信箱', '地址', '地址經緯度'],
                range: 1  // 跳過標題行
            });
            
            console.log('成功讀取Excel資料，資料長度:', jsonData.length);
            if (jsonData.length > 0) {
                console.log('第一筆原始資料:', jsonData[0]);
            }
            
            processExcelData(jsonData);
        })
        .catch(error => {
            console.error('讀取Excel檔案發生錯誤:', error);
            const listCount = document.getElementById('list-count');
            if (listCount) {
                listCount.textContent = '讀取資料時發生錯誤';
            }
        });

    // 回到頂端按鈕功能
    const backToTopButton = document.getElementById('back-to-top');

    // 監聽頁面捲動事件
    window.addEventListener('scroll', () => {
        if (window.innerWidth <= 768) { // 只在手機版面啟用
            // 當頁面捲動超過 200px 時顯示按鈕
            if (window.pageYOffset > 200) {
                backToTopButton.style.display = 'block';
            } else {
                backToTopButton.style.display = 'none';
            }
        }
    });

    // 點擊回到頂端按鈕
    backToTopButton.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
});